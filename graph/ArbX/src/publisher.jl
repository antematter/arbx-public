using HTTP
using SHA
using JSON3
using LibPQ
using MultiThreadedCaches
using DataStructures: DefaultDict

using ArbX

################# CONSTANTS ####################
"""Can change values but not the type without impacting performance"""
const l = ReentrantLock()
const pmg, mdg, tokens, feeds = ArbX.initgraph(false)
const lowercased_tokens = lowercase.(tokens) # Check setindex! docstring
const arb_cache = MultiThreadedCache{String,Bool}()
const postgres_conn = LibPQ.Connection("host=72.52.83.238 port=5432 dbname=antematter user=antematter password=P@55w0rd! connect_timeout=10")
const subscribers = DefaultDict{AbstractString,Vector{HTTP.WebSockets.WebSocket}}(
    HTTP.WebSockets.WebSocket[]
)

################################################

# MUST BE CALLED BEFORE ANY CONCURRENT CODE EXECUTION; 
# ONLY ONE THREAD RUNNING AT THIS POINT (the thread in which this script is launched)
# SO IT IS PRESUMABLY *SAFE* BUT ANY MORE AND RACE CONDITIONS CAN OCCUR
init_cache!(arb_cache)

function initDB()
    query = """
            CREATE TABLE IF NOT EXISTS arbitrage (
                arb_hash                text        PRIMARY KEY,
                timestamp               TIMESTAMP,
                profit_potential        numeric,
                tokens                  text[],
                prices                  numeric[],
                volumes                 numeric[],
                trades                  text[],
                markets                 text[]
            )
            """
    try
        execute(postgres_conn, query)
        @info "Database initialized"
    catch e
        throw(e)
    end
end

function getnftcount(pubkey::AbstractString)
    cmd = Sys.iswindows() ? Cmd(`cmd /C yarn start $pubkey`, dir="metaplex-scripts") :
          Cmd(`yarn start $pubkey`, dir="metaplex-scripts")

    b = IOBuffer()
    run(pipeline(cmd, stdout=b))
    return parse(Int32, split(String(take!(b)), "\n")[3])
end

function safepush(pubkey::AbstractString, ws::HTTP.WebSockets.WebSocket)
    n = getnftcount(pubkey)
    if n == -1
        HTTP.WebSockets.send(ws, JSON3.write(
            Dict("error" => "Error: Invalid pubkey received.")
        ))
        return
    end

    if length(subscribers[pubkey]) < n
        lock(l) do
            push!(subscribers[pubkey], ws)
        end
        return
    end

    HTTP.WebSockets.send(ws, JSON3.write(
        Dict("error" => "Maximum connection count reached for pubkey $pubkey")
    ))
end

function write_arb_to_db(arb::Dict{String,Any})
    query = """
            INSERT INTO arbitrage
            (arb_hash, timestamp, profit_potential, tokens, prices, volumes, trades, markets)
            VALUES 
            (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8)
    """
    try
        LibPQ.load!(
            (
                arb_hash=[arb |> JSON3.write |> sha256 |> bytes2hex],
                timestamp=[arb["timestamp"]],
                profit_potential=[arb["profit_potential"]],
                tokens=[arb["tokens"]],
                prices=[arb["prices"]],
                volumes=[arb["volumes"]],
                trades=[arb["trades"]],
                markets=[arb["markets"]],
            ),
            postgres_conn,
            query
        )
    catch e
        @error "Error writing to database " arb e
        @warn "Rolling back"
        execute(postgress_conn, "ROLLBACK") # don't poison future transactions on the same connection
        return
    end
    @debug "Arbitrage written to database"
end

function publish_arb(arb_path::AbstractString)
    global subscribers
    @info "Publishing arbitrage to " subscribers
    @info arb_path

    lsubs = copy(subscribers)
    for (_, wss) in lsubs
        for ws in wss
            try
                HTTP.WebSockets.send(ws, arb_path)
                @info "Arbitrage written to websocket " ws

            catch error
                @error "Error sending to websocket " ws
                @error error
            end
        end
    end
end

publish_arb(arbs::AbstractVector{Dict{String,Any}}) = begin
    for arb in arbs
        arb_hash = arb |> JSON3.write |> sha256 |> bytes2hex
        if !MultiThreadedCaches.hit(arb_cache, arb_hash) # arb not in cache 
            lock(l) do
                publish_arb(arb |> JSON3.write)
                write_arb_to_db(arb)
                get!(arb_cache, arb_hash) do
                    true # the value is never really needed but cba changing the API
                end
            end
        end
    end
end

publish_arb(::Nothing) = nothing

function logarbs(pmg, mdg, tokens, t1::T, t2::T) where {T<:Integer}
    arb1 = Threads.@spawn findNarb(mdg, tokens, t1)
    arb2 = Threads.@spawn findNarb(mdg, tokens, t2)

    arb2_1 = Threads.@spawn find2arb(pmg, tokens, t1, t2)

    Threads.@spawn publish_arb(fetch(arb1))
    Threads.@spawn publish_arb(fetch(arb2))
    Threads.@spawn publish_arb(fetch(arb2_1))
end

"""
    main 

Launch HTTP.WebSockets server on port 8084 that stores connections in the global `subscribers`.
"""
function main()
    global subscribers

    websocket_task = Threads.@spawn HTTP.WebSockets.listen("0.0.0.0", Base.UInt16(8084)) do ws::HTTP.WebSockets.WebSocket
        local pubkey
        try
            @info "New websocket connection " ws
            pubkey = HTTP.WebSockets.receive(ws)
            @info "Pubkey received " pubkey
            safepush(pubkey, ws)

            while true
                HTTP.WebSockets.ping(ws)
                sleep(20)
            end
        catch error
            @warn "Websocket closed " ws
            @error error
            # if pubkey never got received this should throw an error and just die 
            lock(l) do
                filter!(v -> v != ws, subscribers[pubkey])
                length(subscribers[pubkey]) == 0 && delete!(subscribers, pubkey)
            end
        end
    end

    wait(websocket_task)
    nothing
end

setindexes(x::ArbX.Types.DataPacket) = begin
    setindex!(pmg, lowercased_tokens, x)
    setindex!(mdg, lowercased_tokens, x)
end

launch() = begin
    initDB()
    serialize(NEO4J_CONNECTION, mdg, tokens) # Initial serialization 

    # merge updates to the graph; don't delete and reset
    Threads.@spawn Timer(_ -> serialize(NEO4J_CONNECTION, mdg, tokens; delete=false), 5; interval=5 * 60) # serialize every 10 minutes 

    Threads.@threads for _feed in feeds
        @info "Launching feed " _feed
        feed(_feed,
            x -> isnothing(x) ? nothing : logarbs(pmg, mdg, tokens, x...),
            x -> setindexes(x);
            validate=false
        )
    end

end

# Always launch these concurrently; main can be without async in case REPL control is not required
@info "Launching WebSocket server ... "
Threads.@spawn launch()
main()

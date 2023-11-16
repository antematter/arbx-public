using HTTP
using JSON
using Neo4j
using WebSockets
using Logging
using Base.Iterators: partition

global_logger(WebSocketLogger(stderr, Logging.Debug));

@info "Sleeping for the first 45 seconds to allow the database to start up"
sleep(45)
@info "Starting up"

include("data_loader.jl")

const serum_vial_url = get(ENV, "SERUM_VIAL_URL", "wss://api.serum-vial.dev/v1/ws")

validate_result_set = errors::Vector{Any} -> length(errors) > 0 && throw(ErrorException("Query to Neo4j failed. Errors are $errors"))

function get_all_pairs()
    return split(open(f -> read(f, String), "pair_backup.txt"), "\n")
end

function set_bid(c::Connection, pair::Pair{<:AbstractString,<:AbstractString}, current_bid::AbstractFloat)::Bool
    set_bid = "MATCH (:Security {name : \$first})-[bid:BID]-(:Security {name : \$second}) " *
              "SET bid.price = \$price"

    try
        tx = Neo4j.transaction(c)
        tx(set_bid, "first" => pair.first, "second" => pair.second, "price" => current_bid)
        results = Neo4j.commit(tx)
        validate_result_set(results.errors)
        return true
    catch error
        @error "Error setting bid for " pair
        @error error
        return false
    end
end

function set_ask(c::Connection, pair::Pair{<:AbstractString,<:AbstractString}, current_ask::AbstractFloat)::Bool
    set_ask = "MATCH (:Security {name : \$first})-[ask:ASK]-(:Security {name : \$second}) " *
              "SET ask.price = \$price"

    try
        tx = Neo4j.transaction(c)
        tx(set_ask, "first" => pair.first, "second" => pair.second, "price" => 1 / current_ask)
        results = Neo4j.commit(tx)
        validate_result_set(results.errors)
        return true
    catch error
        @error "Error setting ask for " pair
        @error error
        return false
    end
end

function callback(c::Connection, pair::Pair{<:AbstractString,<:AbstractString}, dump::Dict{String,Any})
    bid_set, ask_set = false, false

    if haskey(dump, "bestBid")
        best_bid, _ = dump["bestBid"]
        bid_set = set_bid(c, pair, parse(Float64, best_bid))
    end

    if haskey(dump, "bestAsk")
        best_ask, _ = dump["bestAsk"]
        ask_set = set_ask(c, pair, parse(Float64, best_ask))
    end

    @info "Pair: " pair
    @info "Bid set was " bid_set
    @info "Ask set was " ask_set

    if bid_set || ask_set
        @info "Sending request to arbitrage server for " pair
        r = HTTP.request("POST", "http://arbitrage:8085", [], JSON.json(Dict("first" => pair[1], "second" => pair[2])))
        @info "Arbitrage server responded with a status of " r.status " for " pair
    end
end

generate_payload(pair::T) where {T<:AbstractString} = begin
    return Dict(
        "op" => "subscribe",
        "channel" => "level1",
        "markets" => [pair]
    )
end

generate_payload(pair::AbstractVector{<:AbstractString}) = begin
    return Dict(
        "op" => "subscribe",
        "channel" => "level1",
        "markets" => [pair...]
    )
end

construct_pair = pair::AbstractString -> Pair((split(pair, "/") .|> String)...)

function validatepairs(mkts::Vector{<:AbstractString})::Vector{<:AbstractString}
    payload = generate_payload(mkts)
    ch = Channel{Vector{String}}(1)

    WebSockets.open(serum_vial_url) do ws
        if writeguarded(ws, JSON.json(payload))
            data, success = readguarded(ws)
            data = data |> String |> JSON.parse


            if data["type"] == "error" && success
                message = data["message"]
                put!(ch, findlast("Allowed values:", message).stop |>
                         head -> chop(message, head=head, tail=1) |>
                                 ps -> split(ps, ",") .|>
                                       ps -> chop(ps, head=2, tail=1)
                )
            else
                put!(ch, mkts)
            end
        end
    end
    take!(ch)
end

function main(c::Connection)
    all_pairs = validatepairs(["Invalid pair"])
    partitionsize = ceil(Int, length(all_pairs) / 8)

    @sync map(partition(all_pairs, partitionsize)) do pairs
        @async begin
            while true
                try
                    @info "Opening websocket for " pairs
                    WebSockets.open(serum_vial_url; readtimeout=60) do ws
                        payload = generate_payload(pairs)
                        if writeguarded(ws, JSON.json(payload))
                            while isopen(ws)
                                data, success = readguarded(ws)
                                if success
                                    dump = JSON.parse(String(data))
                                    @info "Data dumped is " dump

                                    if dump["type"] == "quote"
                                        market = Pair(split(dump["market"], "/")...)
                                        callback(c, market, dump)
                                    end
                                else
                                    @error "Websocket failed for " pairs
                                    @info "Sleeping for 10 seconds"
                                    sleep(10)
                                    return
                                end
                            end
                        end
                    end
                catch error
                    @error "Error encountered for " pairs
                    @error error
                end
            end
        end
    end
end

@info "Spinning up feeds"
main(DataLoader.db_connection)

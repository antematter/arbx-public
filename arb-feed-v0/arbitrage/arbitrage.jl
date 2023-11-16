using Neo4j
using JSON
using HTTP

@info "Sleeping for the first 45 seconds to allow the database to start up"
sleep(45)
@info "Starting up"

subscribers = HTTP.WebSockets.WebSocket[]
conn = Neo4j.Connection("neo4j"; user="neo4j", password="changeme")

validate_result_set = errors::Vector{Any} -> length(errors) > 0 && throw(ErrorException("Query to Neo4j failed. Errors are $errors"))

function arbitrage(conn::Connection, security::AbstractString)
    arb_query = "MATCH p = (s:Security { name : \$security})-[:ASK|BID *3..5]->(s) " *
                "WITH reduce(arb = 1, r in relationships(p) | arb * r.price) as profit_potential, " *
                "p ORDER BY profit_potential DESC " *
                "WHERE profit_potential > 1.0 " *
                "RETURN profit_potential, [n in nodes(p) | n.name] as tokens, " *
                "[r in relationships(p) | TYPE(r)] as trades, " *
                "[r in relationships(p) | r.price] as prices " *
                " limit 2 "

    tx = Neo4j.transaction(conn)
    tx(arb_query, "security" => security)
    results = Neo4j.commit(tx)
    validate_result_set(results.errors)

    jsons = []
    data = results.results[1]["data"]
    for arbs in data
        row = arbs["row"]
        arb_serializable = Dict(
            "profit_potential" => row[1],
            "tokens" => row[2],
            "trades" => row[3],
            "prices" => row[4],
            "markets" => ["SRM" for _=1:length(row[3])]
        )
        push!(jsons, arb_serializable)
    end

    return JSON.json(jsons)
end

function publish_arb(arb_path::AbstractString)
    global subscribers
    @info "Publishing arbitrage to " subscribers

    lsubs = copy(subscribers)
    @async begin
        for ws in lsubs
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

function handle_http_request(conn::Connection, pair::Dict{String,Any})
    @info "Handling request for " pair

    first = arbitrage(conn, pair["first"])
    first_dict = JSON.parse(first)

    if length(first_dict) > 0
        @info "Arbitrage found " first_dict
        publish_arb(first)
    end

    second = arbitrage(conn, pair["second"])
    second_dict = JSON.parse(second)

    if length(second_dict) > 0
        @info "Arbitrage found " second_dict
        publish_arb(second)
    end
end

function main()
    global subscribers

    websocket_task = @async HTTP.WebSockets.listen("0.0.0.0", Base.UInt16(8084)) do ws::HTTP.WebSockets.WebSocket
        try
            @info "New websocket connection " ws
            push!(subscribers, ws)

            while true
                HTTP.WebSockets.ping(ws)
                sleep(20)
            end
        catch error
            @warn "Websocket closed " ws
            @error error
            filter!(x -> x != ws, subscribers)
        end
    end

    http_task = @async HTTP.serve("0.0.0.0", 8085; stream=true) do http::HTTP.Stream
        try
            while !eof(http)
                data = JSON.parse(String(readavailable(http)))
                handle_http_request(conn, data)
            end

            HTTP.setstatus(http, 200)
            startwrite(http)
            write(http, "OK")

            nothing
        catch error
            @error "Error handling HTTP request "
            @error error

            HTTP.setstatus(http, 500)
            startwrite(http)
            write(http, "ERROR")
        end
    end

    wait(http_task)
    wait(websocket_task)

    nothing
end

main()
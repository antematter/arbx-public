module DataLoader

export db_connection, load_data

using Neo4j, DataFrames, WebSockets
using JSON
using HTTP

const db_connection = Connection("neo4j"; user="neo4j", password="changeme")

const serum_vial_url = get(ENV, "SERUM_VIAL_URL", "wss://api.serum-vial.dev/v1/ws")

function get_all_pairs(connection::Connection)
    return split(open(f -> read(f, String), "pair_backup.txt"), "\n") .|> String
end

function merge_nodes(connection::Connection,
    pair::Pair,
    best_bid::AbstractString,
    best_ask::AbstractString,
)::Result
    node1, node2 = pair[1], pair[2]

    tx = transaction(connection)
    tx("MERGE (s:Security {name : \$node1})" *
       "MERGE (s1:Security {name : \$node2})" *
       "MERGE (s)-[:BID { price : \$bid}]->(s1)" *
       "MERGE (s1)-[:ASK { price : \$ask}]->(s)",
        "node1" => node1,
        "node2" => node2,
        "ask" => 1 / parse(Float64, best_ask),
        "bid" => parse(Float64, best_bid),
    )

    results = commit(tx)
    @info "Merged nodes. Results are " results
    return results
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

all_pairs = validatepairs(["Invalid pair"])
all_pair_dict = Dict{String,Bool}(p => false for p in all_pairs)

delete_old_graph = transaction(db_connection)
delete_old_graph(
    "MATCH (n) DETACH DELETE n"
)

@info "Deleting old graph"
@info commit(delete_old_graph)

@info "Initializing new graph"
map(all_pairs) do pair
    @info "Merging pair: " pair
    WebSockets.open(serum_vial_url) do ws
        payload = generate_payload(pair)
        if writeguarded(ws, JSON.json(payload))
            while isopen(ws)
                data, success = readguarded(ws)
                if success
                    dump = JSON.parse(String(data))
                    if dump["type"] == "error" || !haskey(dump, "bestAsk") || !haskey(dump, "bestBid")
                        @error "Invalid pair: " pair
                        return
                    end

                    @info "Found a qualified merge for " pair
                    if all_pair_dict[pair] == false
                        all_pair_dict[pair] = true
                        merge_nodes(db_connection, construct_pair(pair), dump["bestBid"][1], dump["bestAsk"][1])
                        return
                    end
                end
            end
        end
    end
end

@info "Graph has been intialized"
end

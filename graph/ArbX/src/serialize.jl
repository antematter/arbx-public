using Printf
using Neo4j
using ProgressBars

const NEO4J_CONNECTION = Connection("72.52.83.236"; user="neo4j", password="changeme") # Prod 
# const NEO4J_CONNECTION = Connection("localhost"; user="thall", password="1234") # Dev

function deletegraph(c::Connection)
    delete_old_graph = transaction(c)
    delete_old_graph(
        "MATCH (n) DETACH DELETE n"
    )
    commit(delete_old_graph)
end

function serialize(c::Connection, mdg::MetaDiGraph, tokens::Vector{<:AbstractString}; delete=true)
    @info "Serializing graph..."
    try
        delete && deletegraph(c)
        tx = transaction(c)

        token_iter = ProgressBar(tokens)
        for token in token_iter
            tx("MERGE (s:Security {name : \$token})", "token" => token)
            set_description(token_iter, string(@sprintf("Token: %s", token)))
        end
        commit(tx)

        edge_iter = ProgressBar(edges(mdg))
        for edge in edge_iter
            tx = transaction(c)
            side = get_prop(mdg, edge, :side)
            if delete # Virgin graph 
                # No need to specify direction of the relationships; the edges 
                # are stored separately for each direction, bid or ask 
                tx("MATCH (s:Security {name : \$src})" *
                   "MATCH (s1:Security {name : \$dst})" *
                   "MERGE (s)-[:$(side == bid ? "BID" : "ASK") { price : \$price, vol : \$vol, amm : \$amm }]-(s1)",
                    "src" => tokens[src(edge)],
                    "dst" => tokens[dst(edge)],
                    "price" => 0.0,
                    "vol" => get_prop(mdg, edge, :size),
                    "amm" => get_prop(mdg, edge, :amm)
                )
            else # Chad graph
                price = side == bid ? get_prop(mdg, edge, :weight) : 1.0 / get_prop(mdg, edge, :weight)
                tx(
                    "MATCH (s:Security {name: \$src})-[r:$(side == bid ? "BID" : "ASK")]-(s1:Security {name: \$dst})" *
                    "SET r = { amm: \$amm, price: \$price, vol: \$vol }",
                    "src" => tokens[src(edge)],
                    "dst" => tokens[dst(edge)],
                    "price" => price,
                    "vol" => get_prop(mdg, edge, :size),
                    "amm" => get_prop(mdg, edge, :amm)
                )
            end
            commit(tx)
            set_description(edge_iter, string(@sprintf("Edge: %s", join([tokens[src(edge)], tokens[dst(edge)]], "-"))))
        end
    catch e
        @warn "Error with serializing graph " e
        return
    end
    @info "Serializing Done."
end

function serialize(c::Connection, pmg::PairMultigraph, tokens::Vector{<:AbstractString})
    @info "Serializing multigraph..."
    try
        tx = transaction(c)
        for token in tokens
            tx("MERGE (s:Security {name : \$token})", "token" => token)
        end
        commit(tx)

        for edge in edges(pmg)
            tx = transaction(c)
            tx("MATCH (s:Security {name : \$src})" *
               "MATCH (s1:Security {name : \$dst})" *
               "MERGE (s)-[:BID { price : \$bid, vol : \$bidvol }]->(s1)" *
               "MERGE (s1)-[:ASK { price : \$ask, vol : \$askvol }]->(s)",
                "src" => src(edge),
                "dst" => dst(edge),
                "ask" => weights(pmg)[edge].ask,
                "bid" => weights(pmg)[edge].bid,
                "askvol" => weights(pmg)[edge].askvol,
                "bidvol" => weights(pmg)[edge].bidvol
            )
            commit(tx)
        end
    catch e
        @warn "Error with serializing graph " e
        return
    end
    @info "Serializing Done."
end
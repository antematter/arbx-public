"""
    find2arb(pmg::PairMultigraph, tokens::Vector{<:AbstractString}, ids::Vararg{Int64})

Find the arbitrage opportunities in the PairMultigraph such that the best bid on a market is greater than the best ask on any other.
The scanning is performed on the indexes `ids` of `tokens` only.  
"""
function find2arb(pmg::PairMultigraph, tokens::Vector{<:AbstractString}, ids::Vararg{Int64})::Union{Vector{Dict{String,Any}},Nothing}
    t1, t2 = ids
    !(has_edge(pmg, t1, t2) && has_edge(pmg, t2, t1)) && return nothing

    minask = argmin(x -> x.price, weights(pmg, t2, t1))
    maxbid = argmax(x -> x.price, weights(pmg, t1, t2))

    (maxbid.price == 0.0 || minask.price == 0.0) && return nothing
    (maxbid.amm == minask.amm) && return nothing

    profit = maxbid.price / minask.price

    if profit >= PROFIT_CAP
        return [
            Dict(
                "profit_potential" => profit,
                "tokens" => [tokens[t2], tokens[t1], tokens[t2]],
                "trades" => ["ASK", "BID"],
                "prices" => [1.0 / minask.price, maxbid.price],
                "volumes" => [minask.size, maxbid.size],
                "markets" => [minask.amm, maxbid.amm],
                "timestamp" => now(),
            ),
            Dict(
                "profit_potential" => profit,
                "tokens" => [tokens[t1], tokens[t2], tokens[t1]],
                "trades" => ["BID", "ASK"],
                "prices" => [maxbid.price, 1.0 / minask.price],
                "volumes" => [maxbid.size, minask.size],
                "markets" => [maxbid.amm, minask.amm],
                "timestamp" => now(),
            )
        ]
    end
    nothing
end
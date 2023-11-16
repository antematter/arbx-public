using Documenter

getweight(g::MetaDiGraph, u::T, v::T) where {T<:Integer} = begin
    get_prop(g, u, v, :side) == ask && return -log(1.0 / get_prop(g, u, v, :weight))
    return -log(get_prop(g, u, v, :weight))
end

"""
    bellman_ford_return_cycle(graph::MetaDiGraph, s::T) where T<:Integer

Return a tuple of distances, predecessors and vector of cycles in the graph if they exist, 
otherwise returns an empty vector in the third position. 
"""
function bellman_ford_return_cycle(graph::MetaDiGraph, s::T) where {T<:Integer}
    nvg = nv(graph)
    dists = fill(typemax(Float64), nvg)
    predecessors = zeros(T, nvg)

    dists[s] = 0.0

    for _ = 1:nvg
        for e ∈ edges(graph)
            # Bellman-Ford relaxation 
            u, v = src(e), dst(e)
            weight = getweight(graph, u, v)
            if dists[u] + weight < dists[v]
                dists[v] = dists[u] + weight
                predecessors[v] = u
            end
        end
    end

    # Check for negative-weight cycles
    allcycles = []
    seen = falses(nvg)

    for e ∈ edges(graph)
        u, v = src(e), dst(e)
        seen[v] && continue

        weight = getweight(graph, u, v)
        if dists[u] + weight < dists[v]
            cycle = Int[]
            x = u
            while true
                push!(cycle, x)
                seen[x] = true
                x = predecessors[x]
                if x == u || x in cycle
                    break
                end
            end

            idx = findfirst(==(x), cycle)
            push!(cycle, x)
            push!(allcycles, reverse(cycle[idx:end]))
        end
    end

    return dists, predecessors, allcycles
end


@doc raw"""
    calculate_profit_potential(mdg::MetaDiGraph, cycle::Vector{<:Integer})

Calculate a profit potential from the given cycle and the graph. 

# Formula

```math
\begin{aligned}
profit\_potential(mdg, cycle) = \prod_{n=1}^{length(cycle) - 1}
         \begin{cases}
           \text{$price(mdg, n, n + 1)^{-1}$} &\text{if $side(mdg, n, n + 1) = ask$}\\
           \text{$price(mdg, n, n + 1)$} &\text{if $side(mdg, n, n + 1) = bid$}\\
         \end{cases}
\end{aligned}
```
"""
function calculate_profit_potential(mdg::MetaDiGraph, cycle::Vector{<:Integer})
    profit_potential = 1.0
    for i = 1:length(cycle)-1
        weight = get_prop(mdg, cycle[i], cycle[i+1], :weight)
        side = get_prop(mdg, cycle[i], cycle[i+1], :side)
        profit_potential *= side == bid ? weight : 1.0 / weight
    end
    return profit_potential
end

"""
    extractarb(mdg::MetaDiGraph, cycle::Vector{<:Integer}, tokens::Vector{<:AbstractString}) 

Return a Dict containing arbitrage information extracted from the `cycle`. 

The Dict contains the following attributes:
* `profit_potential::Float64` : A floating-point number indicating the expected profit. See also [`calculate_profit_potential`](@ref).
* `tokens::Vector{AbstractString}` : List of tokens that form the `cycle`.
* `trades::Vector{AbstractString}` : List of trade sides (ask or bid) indicating the direction of the swap.
* `prices::Vector{Float64} ` : List of prices at the time of arbitrage detection. Ask prices are reciprocated.
* `volumes::Vector{Float64} ` : List of volumes available at the price levels given in `prices`.
* `markets::Vector{AbstractString} ` : List of markets (DEX or AMM) that participate in the arbitrage. The `n-th` swap should be performed on the `n-th` market.
* `timestamp::DateTime` : Timestamp at the time of arb extraction (computed internally to avoid collisions abroad).
"""
function extractarb(mdg::MetaDiGraph, cycle::Vector{<:Integer}, tokens::Vector{<:AbstractString})::Union{Dict{String,Any},Nothing}
    profit = calculate_profit_potential(mdg, cycle)

    # Profit capping and cutting off arb length 
    (profit <= PROFIT_CAP || length(cycle) > ARB_LEG_CAP) && return nothing

    tokens_ = tokens[cycle]

    trades = [get_prop(mdg, cycle[i], cycle[i+1], :side) == bid ? "BID" : "ASK" for i = 1:length(cycle)-1]

    getprice(i) = get_prop(mdg, cycle[i], cycle[i+1], :weight)
    prices = [trades[i] == "ASK" ? 1.0 / getprice(i) : getprice(i) for i = 1:length(cycle)-1]

    volumes = [get_prop(mdg, cycle[i], cycle[i+1], :size) for i = 1:length(cycle)-1]
    markets = [get_prop(mdg, cycle[i], cycle[i+1], :amm) for i = 1:length(cycle)-1]

    return Dict(
        "profit_potential" => profit,
        "tokens" => tokens_,
        "trades" => trades,
        "prices" => prices,
        "volumes" => volumes,
        "markets" => markets,
        "timestamp" => now(),
    )
end

function findNarb(mdg::MetaDiGraph, tokens::Vector{<:AbstractString}, source::T) where {T<:Integer}
    @debug "Finding N arb .. for " tokens[source]
    dists, predecessors, cycles = bellman_ford_return_cycle(mdg, source)

    filter(==(Inf), dists) |> length > 0 && @debug "Infinite distance from source $source" dists
    filter(==(zero(Int)), predecessors) |> length > 1 && @debug "Zero predecessors from source $source" predecessors

    length(cycles) == 0 && return nothing

    arbs = Vector{Dict{String,Any}}()
    for cycle in unique(cycles)
        arb = extractarb(mdg, cycle, tokens)
        !isnothing(arb) && push!(arbs, arb)
    end

    return length(arbs) > 0 ? arbs : nothing
end
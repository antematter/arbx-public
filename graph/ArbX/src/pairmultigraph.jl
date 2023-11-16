using Base.Iterators: flatten

import Base.setindex!
import Base.==

setprice!(pd::PriceData, price::Real, size::Real, amm::AbstractString) = begin
    pd.price = price
    pd.size = size
    pd.amm = amm
end

setprice!(::PriceData, ::Missing, ::Missing, ::AbstractString) = nothing

"""
    setindex!(pmg::PairMultigraph, tokens::Vector{<:AbstractString}, packet::DataPacket)

Update and returns the indices of the nodes in the graph corresponding to the tokens in the packet.

Note: For correctness and speed reasons, tokens MUST be lowercased.
"""
function setindex!(pmg::PairMultigraph, tokens::Vector{<:AbstractString}, packet::DataPacket)
    t1, t2 = findfirst(==(lowercase(packet.t1)), tokens),
    findfirst(==(lowercase(packet.t2)), tokens)

    any(isnothing, [t1, t2]) && return nothing

    if has_edge(pmg, t1, t2) && has_edge(pmg, t2, t1)
        if !ismissing(packet.ask)
            idxrange = searchsorted(pmg.adjlist[t2], t1)
            p = findfirst(==(PriceData(ask, 0.0, 0.0, packet.amm)), pmg.weights[t2][idxrange])
            isnothing(p) && return nothing # Duct tape for markets that are the other way around
            setprice!(pmg.weights[t2][idxrange.start+(p-1)], packet.ask, packet.asksize, packet.amm)
        end

        if !ismissing(packet.bid)
            idxrange = searchsorted(pmg.adjlist[t1], t2)
            p = findfirst(==(PriceData(bid, 0.0, 0.0, packet.amm)), pmg.weights[t1][idxrange])
            isnothing(p) && return nothing # Duct tape for markets that are the other way around
            setprice!(pmg.weights[t1][idxrange.start+(p-1)], packet.bid, packet.bidsize, packet.amm)
        end
        return t1, t2
    end
    nothing
end

update_edge!(mdg::MetaDiGraph, t1::T, t2::T, price::Real, size::Real, amm::AbstractString) where {T<:Integer} = begin
    set_prop!(mdg, t1, t2, :weight, price)
    set_prop!(mdg, t1, t2, :size, size)
    set_prop!(mdg, t1, t2, :amm, amm)
    true
end

update_edge!(::MetaDiGraph, ::T, ::T, ::Missing, ::Missing, ::AbstractString) where {T<:Integer} = false

"""
    LOCK

Useful for avoiding race conditions in setting prices in the MetaDiGraph

Three scenarios: 
1. Zero price currently set: Allow any market to set the price.
2. Same Market Update: Update the price, but not the AMM.
3. New Market Update: Compare price and set the better one.

All 3 scenarios are in a race condition to set the price: for example, at zero price 
Orca and Serum both send price updates; without acquiring lock, it's difficult to determine
which of these prices will be set first. 
"""
const LOCK = ReentrantLock()

"""
    setindex!(mdg::MetaDiGraph, tokens::Vector{<:AbstractString}, packet::DataPacket)

Update and return the indices of the nodes in the graph corresponding to the tokens in the packet.
Specialized for MultiDiGraph. Compares current price with new price and updates the edge weight if the new price is better.

Note: For correctness and speed reasons, tokens MUST be lowercased.
"""
function setindex!(mdg::MetaDiGraph, tokens::Vector{<:AbstractString}, packet::DataPacket)

    t1, t2 = findfirst(==(lowercase(packet.t1)), tokens),
    findfirst(==(lowercase(packet.t2)), tokens)

    any(isnothing, [t1, t2]) && return nothing

    set::Bool = false
    if has_edge(mdg, t1, t2) && has_edge(mdg, t2, t1)
        if !ismissing(packet.ask)
            lock(LOCK) do
                if packet.amm == get_prop(mdg, t2, t1, :amm)
                    set = update_edge!(mdg, t2, t1, packet.ask, packet.asksize, packet.amm)
                else
                    currentprice = get_prop(mdg, t2, t1, :weight)
                    set = (currentprice == 0.0 || packet.ask < currentprice) &&
                          update_edge!(mdg, t2, t1, packet.ask, packet.asksize, packet.amm)
                end
            end
        end

        if !ismissing(packet.bid)
            lock(LOCK) do
                if packet.amm == get_prop(mdg, t1, t2, :amm)
                    set = update_edge!(mdg, t1, t2, packet.bid, packet.bidsize, packet.amm)
                else
                    currentprice = get_prop(mdg, t1, t2, :weight)
                    set = (currentprice == 0.0 || packet.bid > currentprice) &&
                          update_edge!(mdg, t1, t2, packet.bid, packet.bidsize, packet.amm)
                end
            end
        end
    end

    return set ? (t1, t2) : nothing
end

"""
    topairmultigraph(df::DataFrame)

Return a PairMultigraph constructed from a DataFrame with the required fields. 
Check ArbX.Data for the format. 
"""
function topairmultigraph(df::DataFrame)
    tokens = ((x -> x[uniqueidx(lowercase.(x))]) ∘
              gettokens ∘
              getdata
    )()
    ntokens = length(tokens)
    lowercased_tokens = lowercase.(tokens)
    pmg = PairMultigraph(ntokens, PriceData)

    for row ∈ eachrow(df)
        t1, t2 = findfirst(==(lowercase(row.Token1)), lowercased_tokens),
        findfirst(==(lowercase(row.Token2)), lowercased_tokens)
        add_edge!(pmg, t1, t2, PriceData(bid, 0.0, 0.0, row.Market))
        add_edge!(pmg, t2, t1, PriceData(ask, 0.0, 0.0, row.Market))
    end

    pmg, tokens
end

"""
    topairmultigraph(markets...)

Return a PairMultigraph and unique tokens for a given tuple of AMMs and their pairs.

Markets expected to be in the form: 
```
[(RAY, Vector{String}["BTC/USDT", "ETH/USDT", "SOL/USDT"]), (SOL, Vector{String}["BTC/USDT", "ETH/USDT", "RAY/USDT"]) ...]
```
"""
function topairmultigraph(markets...)
    allpairs = vcat(getindex.(markets, 2)...)
    tokens = (sort ∘
              (x -> x[uniqueidx(lowercase.(x))]) ∘
              collect ∘
              flatten ∘
              x -> split.(x, "/")
    )(allpairs)
    ntokens = length(tokens)
    lowercased_tokens = lowercase.(tokens)

    pmg = PairMultigraph(ntokens, PriceData)
    for (amm, mkts) ∈ markets
        for (tok1, tok2) ∈ split.(mkts, "/")
            t1, t2 = findfirst(==(lowercase(tok1)), lowercased_tokens),
            findfirst(==(lowercase(tok2)), lowercased_tokens)
            add_edge!(pmg, t1, t2, PriceData(bid, 0.0, 0.0, amm))
            add_edge!(pmg, t2, t1, PriceData(ask, 0.0, 0.0, amm))
        end
    end

    return pmg, tokens
end

"""
    topairmultigraph(filterby::String, markets...)

Return a PairMultigraph and unique tokens for a given tuple of AMMs and their pairs. 
Only tokens found in the filterby AMM are preserved.

Markets expected to be in the form: 
```
[(RAY, Vector{String}["BTC/USDT", "ETH/USDT", "SOL/USDT"]), (SOL, Vector{String}["BTC/USDT", "ETH/USDT", "RAY/USDT"]) ...]
```
"""
function topairmultigraph(filterby::String, markets...)
    basemarkets = markets[findfirst(m -> isequal(m[1], filterby), markets)][2]
    tokens = (sort ∘
              (x -> x[uniqueidx(lowercase.(x))]) ∘
              collect ∘
              flatten ∘
              x -> split.(x, "/")
    )(basemarkets)

    ntokens = length(tokens)
    lowercased_tokens = lowercase.(tokens)
    pmg = PairMultigraph(ntokens, PriceData)

    for (amm, mkts) ∈ markets
        for pair ∈ lowercase.(mkts)
            if pair ∈ lowercase.(basemarkets)
                tok1, tok2 = split(pair, "/")
                t1, t2 = findfirst(==(tok1), lowercased_tokens),
                findfirst(==(tok2), lowercased_tokens)
                add_edge!(pmg, t1, t2, PriceData(bid, 0.0, 0.0, amm))
                add_edge!(pmg, t2, t1, PriceData(ask, 0.0, 0.0, amm))
            end
        end
    end

    return pmg, tokens
end

"""
    topairmultigraph(mkts::Vector{<:AbstractString}, amm::AbstractString)

Return a PairMultigraph and unique tokens from given pairs and AMM. 
"""
function topairmultigraph(mkts::Vector{<:AbstractString}, amm::AbstractString)
    tokens = (sort ∘
              (x -> x[uniqueidx(lowercase.(x))]) ∘
              collect ∘
              flatten ∘
              x -> split.(x, "/")
    )(mkts)

    lowercased_tokens = lowercase.(tokens)
    ntokens = length(tokens)

    pmg = PairMultigraph(ntokens, PriceData)

    for (tok1, tok2) ∈ split.(mkts, "/")
        t1, t2 = findfirst(==(lowercase(tok1)), lowercased_tokens),
        findfirst(==(lowercase(tok2)), lowercased_tokens)
        add_edge!(pmg, t1, t2, PriceData(bid, 0.0, 0.0, amm))
        add_edge!(pmg, t2, t1, PriceData(ask, 0.0, 0.0, amm))
    end

    pmg, tokens
end

"""
    tosimpleweightedgraph(pmg::PairMultigraph) -> PairMultigraph

Return a condensed form of a weighted multigraph with only one weight per edge. 

# Examples
```julia-repl
julia> using ArbX, Multigraphs
julia> data(x,y) = ArbX.Types.PriceData(x, y, 10.0, "SRM")
data (generic function with 1 method)

julia> wmg = WeightedDiMultigraph(
                       Dict(
                          1 => [2, 2, 3],
                          2 => [1, 3, 4],
                          3 => [1, 2, 4],
                          4 => [2, 3]
                      ),
                      Dict(
                          1 => [data(bid, 1.28), data(bid, 1.3), data(ask, 0.56)],
                          2 => [data(ask, 1.29), data(bid, 1.43), data(bid, 1.51)],
                          3 => [data(bid, 0.55), data(ask, 1.44), data(ask, 0.96)],
                          4 => [data(ask, 1.52), data(bid, 0.95)]
                      )
                  )
{4, 10} directed Int64 multigraph

julia> pmg = tosimpleweightedgraph(wmg)
{4, 10} directed Int64 multigraph

julia> mul(pmg, 1, 2)
1

julia> mul(wmg, 1, 2)
2
```
"""
function tosimpleweightedgraph(pmg::PairMultigraph)
    pmg = copy(pmg)
    ids = sort!(vertices(pmg))
    for id1 ∈ ids
        for id2 ∈ ids

            idxrange = searchsorted(pmg.adjlist[id1], id2)
            weights = pmg.weights[id1][idxrange]

            length(weights) == 0 && continue

            weight = weights[1].side == bid ? argmax(p -> p.price, weights) : argmin(p -> p.price, weights)

            [popat!(pmg.weights[id1], idxrange.start) for _ = idxrange]
            insert!(pmg.weights[id1], idxrange.start, weight)

            [popat!(pmg.adjlist[id1], idxrange.start) for _ = idxrange]
            insert!(pmg.adjlist[id1], idxrange.start, id2)
        end
    end
    return pmg
end

"""
    tometadigraph(pmg::PairMultigraph) -> MetaDiGraph

Return a MetaDiGraph constructed with the best weights from PairMultigraph.
All fields of PriceData are serialized into the MetaDiGraph with corresponding symbol names.

# Examples
```julia-repl
julia> pmg, _ = topairmultigraph(Data)

julia> g = tometadigraph(pmg)

julia> get_prop(g, 38, 86, :side)
bid::Side = 0
```
"""
function tometadigraph(pmg::PairMultigraph)::MetaDiGraph
    g = MetaDiGraph(nv(pmg), 0.0)
    for e ∈ edges(pmg)
        id1, id2 = src(e), dst(e)
        add_edge!(g, id1, id2)

        idxrange = searchsorted(pmg.adjlist[id1], id2)
        weights = pmg.weights[id1][idxrange]
        weight = weights[1].side == bid ? argmax(p -> p.price, weights) : argmin(p -> p.price, weights)

        set_prop!(g, id1, id2, :side, weight.side)
        set_prop!(g, id1, id2, :weight, weight.price)
        set_prop!(g, id1, id2, :size, weight.size)
        set_prop!(g, id1, id2, :amm, weight.amm)
    end
    return g
end

function printedges(mdg::MetaDiGraph)
    for e ∈ edges(mdg)
        pd = PriceData(
            get_prop(mdg, e, :side),
            get_prop(mdg, e, :weight),
            get_prop(mdg, e, :size),
            get_prop(mdg, e, :amm)
        )
        println("$(src(e)) => $(dst(e)) with weight $pd")
    end
end

function printedges(mdg::MetaDiGraph, filter::Bool)
    for e ∈ edges(mdg)
        pd = PriceData(
            get_prop(mdg, e, :side),
            get_prop(mdg, e, :weight),
            get_prop(mdg, e, :size),
            get_prop(mdg, e, :amm)
        )
        !filter && println("$(src(e)) => $(dst(e)) with weight $pd")
        pd.price == 0.0 && println("$(src(e)) => $(dst(e)) with weight $pd")
    end
end

printedges(pmg::PairMultigraph) =
    for e in edges(pmg)
        println(e)
    end
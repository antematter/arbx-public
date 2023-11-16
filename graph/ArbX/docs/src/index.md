```@meta
CurrentModule = ArbX
```

# ArbX

# Contents 
```@contents
Pages = ["arbx.md", "types.md", "arbitrage.md", "datafeeds.md"]
```

The graph module of `ArbX`. This is where the arbitrage detection algorithms reside. 

Two graphs are maintained currently: `PairMultigraph` and `MetaDiGraph`. These graphs receive price updates from the [`DataFeeds`](@ref) module, which then launches threads to detect arbitrage opportunities in both graphs as described below. The arbitrages are written to a `HTTP.WebSocket` server on port `8084`, that listens for new client connections/subscriptions and then dumps the arbitrage in `JSON` format. For details on the format, check [`Arbitrage.extractarb`](@ref).

## PairMultigraph

The `PairMultigraph` is a [`WeightedDiMultigraph`](https://github.com/antematter/Multigraphs.jl) with [`Types.PriceData`](@ref) weights. The graph follows an adjacency list representation where each node (an `<:Integer`) corresponds to a `Vector{<:Integer}` that represents the connections. The weighted version of the `MultiDigraph`, `PairMultigraph`, also stores a `weights` vector that stores `PriceData` structs as weights. This representation is useful for quickly accessing all connections against a certain node. 

The nodes represent tokens, provided externally, and the edges represent the bid and ask connections between them across markets. Two tokens can have multiple bid and ask connections for each market that they are traded on, e.g Orca and Serum. If the edge `n => m` is a bid, then `m => n` is necessarily ask; this similarly applies in case of multiple connections, in which case an invocation to `weights(graph, n, m)` will return a vector of `PriceData` each of which will have `side == bid`. 

Ultimately, this helps in finding cross-market arbitrage opportunities quickly. If a price update is received on two tokens, `n` and `m`, then accessing the weights for each direction (`n => m` and `m => n`) returns the bids and asks respectively for the tokens across markets. If the maximum bid is higher than the minimum ask, then we have an opportunity where we can buy low and sell high. 

## MetaDiGraph 

For finding arbitrages that involve more than one trade/swap, we need a different data structure. [`MetaDiGraph`](https://github.com/JuliaGraphs/MetaGraphs.jl) provides the required versatility and performance. Summarily, the `Meta` in the name only means that meta data can be stored on any node or edge in the graph. Internally, the data is stored in `Dict` structures that provide fast access to data. 

Unlike `PairMultigraph`, `MetaDiGraph` does not allow multiple connections between any two nodes. This restricts us to store only the best prices between two tokens -- which is exactly what we want. Using [`Arbitrage.bellman_ford_return_cycle`](@ref) we can find negative-weight cycles in the graph, which simply put means you can trade/swap across the cycle and end up with a greater amount than what you started with. For more details, see [`Arbitrage.calculate_profit_potential`](@ref). 

## Appendix

Refer to [`publisher.jl`](https://github.com/antematter/arbx/blob/master/graph/ArbX/src/publisher.jl) for launch details. 


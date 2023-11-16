module Arbitrage

using Dates
using ..Types:
       bid, ask, MetaDiGraph, PairMultigraph,
       PriceData, nv, weights, edges, src, dst,
       get_prop, has_edge

export find2arb, weights, calculatearb,
       bellman_ford_return_cycle, findNarb


const PROFIT_CAP = 1.005
const ARB_LEG_CAP = 5

include("2arbs.jl")
include("bellman_ford.jl")

end
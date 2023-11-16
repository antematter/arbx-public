module Types 

import Base: ==, show
using Multigraphs:
            WeightedDiMultigraph, add_edge!, nv, weights, 
            edges, src, dst, copy, vertices, rem_edge!,
            has_vertex, has_edge

using MetaGraphs: 
            MetaDiGraph, get_prop, set_prop!, has_prop

export DataPacket, PairMultigraph, Side, bid, ask, 
       PriceData, add_edge!, nv, weights, edges, 
       vertices, src, dst, copy, rem_edge!, has_vertex,
       has_edge, MetaDiGraph, get_prop, set_prop!, has_prop

@enum Side bid ask

"""
    PriceData 

Data format for [`PairMultigraph`](@ref) edges. 
"""
mutable struct PriceData 
    side::Side 
    price::Real 
    size::Real
    amm::AbstractString
end

"""
    PairMultigraph

`WeightedDiMultigraph` specialized for [`PriceData`](@ref) edges. 
"""
PairMultigraph = WeightedDiMultigraph

==(pd1::PriceData, pd2::PriceData) = pd1.amm == pd2.amm && pd1.side == pd2.side
show(io::IO, pd::PriceData) = print(io, "Side: $(pd.side) | Price: $(pd.price) | Size: $(pd.size) | AMM: $(pd.amm)")

"""
    DataPacket 

Data format for price updates received by [`feed`](@ref). The graph [`setindex!`](@ref) method expects 
updates in `DataPacket` format. 
"""
struct DataPacket 
    amm::AbstractString
    t1::AbstractString
    t2::AbstractString
    ask::Union{Real, Missing}
    asksize::Union{Real, Missing}
    bid::Union{Real, Missing}
    bidsize::Union{Real, Missing}
end

end
abstract type DataFeed end

# utility function
to_float = x -> parse(Float64, x)

"""
    feed(d::T, args...; kwargs...) where T <: DataFeed

Open a WebSocket or Redpanda connection to listen to the price feeds for a `DataFeed`.

For each update on the connection, execute the functions passed via `args...`. The `args...` are executed via 
`foldr` so the argument-ordering matters; each subsequent function expects a parameter of the type returned by 
the antecedent. 
"""
function feed(d::T, args...; kwargs...) where {T<:DataFeed} end

"""
    validatepairs(::T; mkts::Vector{<:AbstractString})::Vector{<:AbstractString} where T <: DataFeed -> Vector{<:AbstractString}

Validate the markets passed in via `mkts` corresponding to the `DataFeed` passed in the first parameter. 

This is to eliminate any inactive pair from the market. The returned Vector should contain active pairs only.
"""
function validatepairs(::T; mkts::Vector{<:AbstractString})::Vector{<:AbstractString} where {T<:DataFeed} end
module Raydium

using JSON3
using HTTP
using HTTP.WebSockets

using ..DataFeeds: DataFeed, DataPacket
import ..DataFeeds: feed, validatepairs

include("raydiumpairs.jl")
export RAYDIUM_PAIRS, RaydiumFeed

mutable struct RaydiumFeed <: DataFeed
    ws_server::AbstractString
    http_server::AbstractString
    markets::Vector{<:AbstractString}
end

### TODO: VALIDATE PAIRS HERE 
function validatepairs(d::RaydiumFeed; mkts::Vector{<:AbstractString}=d.markets)::Vector{<:AbstractString}
    r = HTTP.get("$(d.http_server)/getState")
    if r.status == 200
        data = r.body |> String |> JSON3.read |> JSON3.read
        data = [join([d.tokenA, d.tokenB], "/") for d in data]
        return data
    end
    throw("Failed to fetch markets from http server $(d.http_server)")
end

function extractpacket(data::JSON3.Object)::DataPacket
    t1, t2 = data.tokenA, data.tokenB
    return DataPacket("RAY",
        t1, t2,
        data.askPrice, data.askSize,
        data.bidPrice, data.bidSize
    )
end

function getstate(d::RaydiumFeed)::JSON3.Array
    r = HTTP.get("$(d.http_server)/getState")
    if r.status == 200
        data = r.body |> String |> JSON3.read |> JSON3.read
        return data
    end
    throw("Failed to fetch state from http_server $(d.http_server)")
end

function feed(d::RaydiumFeed, args...; kwargs...)
    length(d.markets) > 0 || raise(ArgumentError("No markets provided for Raydium"))
    kwargs = Dict(kwargs)
    kwargs[:validate] && (d.markets = validatepairs(d))

    ### Update state 
    state = getstate(d)
    for update in state
        foldr(∘, [args..., extractpacket])(update)
    end

    Threads.@spawn while true
        try
            WebSockets.open(d.ws_server) do ws
                for data in ws
                    data = data |> String |> JSON3.read
                    !any(==(nothing), [data.bidSize, data.askSize, data.bidPrice, data.askPrice]) && begin
                        @debug "Received Raydium quote " data
                        foldr(∘, [args..., extractpacket])(data)
                    end
                end
            end
        catch e
            @warn "Error with Raydium feed " e
        end
    end
end

end
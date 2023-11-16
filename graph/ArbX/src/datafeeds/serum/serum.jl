module Serum

using Memoization
using JSON3, HTTP.WebSockets
using Base.Iterators: partition

using ..DataFeeds: DataFeed, DataPacket, to_float
import ..DataFeeds: feed, validatepairs

include("serumpairs.jl")

export SerumFeed, SERUM_PAIRS

const SERUM_FEED_LIMIT = 8
mutable struct SerumFeed <: DataFeed
    url::String
    markets::Vector{<:AbstractString}
end

function getpayload(mkts::AbstractVector{<:AbstractString})
    Dict("op" => "subscribe", "channel" => "level1", "markets" => [mkts...])
end

function getpayload(mkts::AbstractString)
    Dict("op" => "subscribe", "channel" => "level1", "markets" => [mkts])
end

function extractpacket(data::JSON3.Object)::DataPacket
    t1, t2 = split(data["market"], "/")
    getquote = side -> haskey(data, side) ? data[side] .|> to_float : (missing, missing)
    return DataPacket("SRM", t1, t2, getquote("bestAsk")..., getquote("bestBid")...)
end

@memoize function probeactivity(d::SerumFeed, validpairs::Vector{<:AbstractString})
    activepairs = String[]
    map(validpairs) do pair
        WebSockets.open(d.url) do ws
            payload = getpayload(pair)

            try
                WebSockets.send(ws, JSON3.write(payload))
                data = WebSockets.receive(ws)
                data = data |> String |> JSON3.read

                if data["type"] == "error" || !haskey(data, "bestAsk") || !haskey(data, "bestBid")
                    @warn "Invalid pair " pair
                    return
                end

                push!(activepairs, pair)
            catch e
                @warn "Error probing activity " e
            end
        end
    end

    return activepairs
end


function validatepairs(d::SerumFeed; mkts::Vector{<:AbstractString}=d.markets)::Vector{<:AbstractString}
    ## TODO: CHECK ON EACH 10-FOLD NOT JUST THE FIRST
    payload = getpayload(mkts[length(mkts) > 10 ? 10 : length(mkts)])
    ch = Channel{Vector{String}}(1)
    WebSockets.open(d.url) do ws
        try
            WebSockets.send(ws, JSON3.write(payload))
            data = WebSockets.receive(ws)
            data = data |> String |> JSON3.read

            if data["type"] == "error"
                message = data["message"]
                put!(ch, findlast("Allowed values:", message).stop |>
                         head -> chop(message, head=head, tail=1) |>
                                 ps -> split(ps, ",") .|>
                                       ps -> chop(ps, head=2, tail=1)
                )
            else
                put!(ch, mkts)
            end
        catch e
            @warn "Error validating pairs " e
        end
    end
    take!(ch)
end

function openfeed(d::SerumFeed, pairs::Union{AbstractString,AbstractVector{<:AbstractString}}, args...)
    while true
        WebSockets.open(d.url) do ws
            @debug "Opening Serum feed for " pairs
            payload = getpayload(pairs)

            try
                WebSockets.send(ws, JSON3.write(payload))

                Threads.@spawn while isopen(ws)
                    @debug "pinging ... "
                    WebSockets.send(ws, "ping")
                    sleep(20)
                end

                for data in ws
                    data = data |> String |> JSON3.read

                    if data["type"] == "error"
                        error("Serum feed server error.\n $(data["message"])")
                    end

                    if data["type"] == "quote"
                        @debug "Received Serum quote" data
                        foldr(∘, [args..., extractpacket])(data)
                    end
                end
            catch e
                @warn "Error with Serum feed " e
            end
        end
    end
end

function feed(d::SerumFeed, args...; kwargs...)
    length(d.markets) > 0 || raise(ArgumentError("No markets provided for Serum"))
    kwargs = Dict(kwargs)
    kwargs[:validate] && (d.markets = validatepairs(d))
    partitionsize = ceil(Int, length(d.markets) / SERUM_FEED_LIMIT)
    @sync map(partition(d.markets, partitionsize)) do pairs
        @debug "Subscribing to " pairs
        Threads.@spawn openfeed(d, pairs, args...)
    end
end

end
module Binance

using JSON3
using HTTP.WebSockets

using ..DataFeeds: DataFeed, DataPacket, to_float
import ..DataFeeds: feed, validatepairs

include("binancepairs.jl")
export BINANCE_PAIRS, BinanceFeed

mutable struct BinanceFeed <: DataFeed
    endpoint::AbstractString
    markets::Vector{<:AbstractString}
end

function validatepairs(d::BinanceFeed, mkts::Vector{<:AbstractString}=d.markets)::Vector{<:AbstractString}
    return mkts
end

function getpayload(mkts::AbstractVector{<:AbstractString})
    Dict(
        "method" => "SUBSCRIBE",
        "params" => ["$(replace(mkt, "/" => "") |> lowercase)@bookTicker" for mkt in mkts],
        "id" => 4
    )
end

function getpayload(mkt::AbstractString)
    Dict(
        "method" => "SUBSCRIBE",
        "params" => ["$(replace(mkt, "/" => "") |> lowercase)@bookTicker"],
        "id" => 4
    )
end

function extractpacket(data::JSON3.Object; kwargs...)::DataPacket
    kwargs = Dict(kwargs)
    pair = kwargs[:mapping][data.stream]

    DataPacket(
        "Binance",
        pair[1], pair[2],
        to_float(data.data.a), to_float(data.data.A), # Binance guaranteed to return a quote for both sides 
        to_float(data.data.b), to_float(data.data.B)  # because it's a book ticker lol
    )
end

function feed(d::BinanceFeed, args...; kwargs...)
    length(d.markets) > 0 || raise(ArgumentError("No markets provided for Binance"))
    kwargs = Dict(kwargs)
    kwargs[:validate] && (d.markets = validatepairs(d))

    stream2mkt = Dict(
        string(replace(mkt, "/" => "") |> lowercase, "@bookTicker") => split(mkt, "/")
        for mkt in d.markets
    )

    Threads.@spawn while true
        WebSockets.open(d.endpoint) do ws
            payload = getpayload(d.markets)
            try
                WebSockets.send(ws, JSON3.write(payload))

                data = receive(ws) |> String |> JSON3.read
                data.result !== nothing && error("Binance subscription failed")

                Threads.@spawn while isopen(ws)
                    @debug "pinging ... "
                    WebSockets.send(ws, "pong")
                    sleep(120) # Binance websocket server sends a ping frame every 3 minutes and expects a pong within 10 mins
                end

                for data in ws
                    data = data |> String |> JSON3.read

                    if haskey(stream2mkt, data.stream)
                        @debug "Received Binance quote" data
                        foldr(∘, [args..., x -> extractpacket(x; mapping=stream2mkt)])(data)
                    end
                end
            catch e
                @warn "Error with feed " e
            end
        end
    end
end

end
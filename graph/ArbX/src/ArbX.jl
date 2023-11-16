module ArbX

using Base.Threads

using XLSX
using DataFrames

include("types.jl")
using .Types
export PairMultigraph, MetaDiGraph, bid, ask

include("utils.jl")

include("datafeeds/DataFeeds.jl")
using .DataFeeds
export SerumFeed, OrcaFeed, RaydiumFeed,
    SaberFeed, BinanceFeed, WhirlpoolFeed,
    feed, validatepairs

include("arbitrage/Arbitrage.jl")
using .Arbitrage
export find2arb, findNarb

include("pairmultigraph.jl")
export setindex!, topairmultigraph, tometadigraph,
    tosimpleweightedgraph, printedges

include("serialize.jl")
export NEO4J_CONNECTION, serialize

######### FOR LIVE GRAPH INITIALIZATION #############

"""
    initgraph(probe::Bool) -> PairMultigraph, MetaDiGraph, Vector{AbstractString}, Tuple{DataFeed...}

Initialize the graphs. If `probe` is true, then check for activity on each pair of every market integrated with the platform. 
Return the graphs, tokens detected, and the feeds.
"""
function initgraph(probe::Bool)
    serum = SerumFeed(
        "wss://vial.mngo.cloud/v1/ws",
        SERUM_PAIRS
    )
    orca = OrcaFeed(
        "ws://72.52.83.236:12000",
        "http://72.52.83.236:15000",
        ORCA_PAIRS
    )
    raydium = RaydiumFeed(
        "ws://72.52.83.236:12001",
        "http://72.52.83.236:15001",
        RAYDIUM_PAIRS
    )
    saber = SaberFeed(
        "ws://72.52.83.236:12002",
        "http://72.52.83.236:15002",
        SABER_PAIRS
    )
    whirlpool = WhirlpoolFeed(
        "ws://72.52.83.236:12003",
        "http://72.52.83.236:15003",
        WHIRLPOOL_PAIRS
    )
    # binance = BinanceFeed(
    #     "wss://stream.binance.com:9443/stream?streams=",
    #     BINANCE_PAIRS
    # )

    if probe
        serum.markets = probeactivity(serum, serumpairs)
        ### TODO: Add probing for other market pairs 
    end

    serum.markets = validatepairs(serum)
    orca.markets = validatepairs(orca)
    raydium.markets = validatepairs(raydium)
    saber.markets = validatepairs(saber)
    whirlpool.markets = validatepairs(whirlpool)
    # binance.markets = validatepairs(binance)

    pmg, tokens = topairmultigraph(
        ("SRM", serum.markets),
        ("ORCA", orca.markets),
        ("RAY", raydium.markets),
        ("SBR", saber.markets),
        ("WPL", whirlpool.markets)
        # ("BNB", binance.markets)
    )

    # pmg, tokens = topairmultigraph(whirlpool.markets, "WPL")
    mdg = (tometadigraph ∘ tosimpleweightedgraph)(pmg)
    return pmg, mdg, tokens, [serum, orca, raydium, saber, whirlpool]
end

end


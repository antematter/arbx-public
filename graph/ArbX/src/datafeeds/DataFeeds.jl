module DataFeeds

using JSON3

using ..Types: DataPacket

include("datafeed.jl")
export DataFeed, feed, validatepairs

include("serum/serum.jl")
using .Serum
export SerumFeed, SERUM_PAIRS

include("orca/orca.jl")
using .Orca
export OrcaFeed, ORCA_PAIRS

include("raydium/raydium.jl")
using .Raydium
export RaydiumFeed, RAYDIUM_PAIRS

include("binance/binance.jl")
using .Binance
export BinanceFeed, BINANCE_PAIRS

include("saber/saber.jl")
using .Saber
export SaberFeed, SABER_PAIRS

include("whirlpool/whirlpool.jl")
using .Whirlpool
export WhirlpoolFeed, WHIRLPOOL_PAIRS

end
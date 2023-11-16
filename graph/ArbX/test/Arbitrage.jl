using Test

using ArbX
using ArbX.Arbitrage
using Multigraphs

data(x, y) = ArbX.Types.PriceData(x, y, 10.0, "SRM")
packet(amm, t1, t2, ask, bid) = ArbX.Types.DataPacket(amm, t1, t2, ask, 10.0, bid, 10.0)

const tokens = ["USDC", "BTC", "USDT", "ETH"]

const pmg = PairMultigraph(Dict(
        1 => [2, 2, 3],
        2 => [1, 1, 3, 4],
        3 => [1, 2, 4],
        4 => [2, 3]
    ),
    Dict(
        1 => [data(bid, 1.28), ArbX.Types.PriceData(bid, 1.3, 10.0, "ORCA"), data(ask, 0.56)],
        2 => [data(ask, 1.29), ArbX.Types.PriceData(ask, 1.15, 10.0, "ORCA"), data(bid, 1.43), data(bid, 1.51)],
        3 => [data(bid, 0.55), data(ask, 1.44), data(ask, 0.96)],
        4 => [data(ask, 1.52), data(bid, 0.95)]
    )
)

@test typeof(pmg) == Multigraphs.WeightedDiMultigraph{Int64,ArbX.Types.PriceData}
const mdg = (tometadigraph ∘ tosimpleweightedgraph)(pmg)
@test typeof(mdg) == MetaDiGraph{Int64,Float64}

arb_idxs = [(1, 2), (1, 3), (2, 1), (3, 2), (3, 4), (4, 2)]

for i = 1:4, j = 1:4
    arbs = find2arb(pmg, tokens, i, j)
    if (i, j) ∈ arb_idxs
        @test length(arbs) > 0
        @test all(arb -> arb["profit_potential"] > 1.0, arbs)
        for arb in arbs
            @test all(==(length(arb["tokens"]) - 1), [length(arb["markets"]),
                length(arb["trades"]), length(arb["volumes"]), length(arb["prices"])])
            @test haskey(arb, "timestamp")
        end
    else
        @test isnothing(arbs)
    end
end

function isequal(A::Float64, B::Float64, epsilon::Float64=1.0e-10)
    if abs(A - B) <= epsilon
        return true
    else
        return false
    end
end

arbs = [arb[1] for arb in map(i -> findNarb(mdg, tokens, i), 1:4)]
@test all(arb -> isequal(arbs[1]["profit_potential"], arb["profit_potential"]), arbs)

arb = findNarb(mdg, tokens, 1)[1]
@test all(==(length(arb["tokens"]) - 1), [length(arb["markets"]),
    length(arb["trades"]), length(arb["volumes"]), length(arb["prices"])])
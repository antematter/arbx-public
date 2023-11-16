using ArbX
using Multigraphs 

data(x,y) = ArbX.Types.PriceData(x, y, 10.0, "SRM")
packet(amm, t1, t2, ask, bid) = ArbX.Types.DataPacket(amm, t1, t2, ask, 10.0, bid, 10.0)

const tokens = ["USDC", "BTC", "USDT", "ETH"]

const wmg = WeightedDiMultigraph(

                       Dict(
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

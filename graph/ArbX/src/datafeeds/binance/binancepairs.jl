# const BINANCE_PAIRS = (() ->
#     begin
#         try
#             r = HTTP.get("""https://api.binance.com/api/v3/exchangeInfo?permissions=""" *
#                          """["MARGIN","LEVERAGED","TRD_GRP_002","TRD_GRP_003","TRD_GRP_004","TRD_GRP_005"]""")

#             if r.status == 200
#                 data = String(r.body) |> JSON3.read
#                 return map(data.symbols) do symbol
#                     base, quote_ = symbol.baseAsset, symbol.quoteAsset
#                     join([base, quote_], "/")
#                 end
#             end
#         catch e
#             error("Error fetching binance pairs $e")
#         end
#     end
# )()

const BINANCE_PAIRS = [
    "SOL/USDT",
    "SOL/USDC",
]
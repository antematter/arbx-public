import { BN } from "bn.js";
import { AutomateMarketMakers } from "../types";
import { ISwapBuilder, SerumSwapCommand, SerumSwapParams } from "./types";

/**
 * - Bids and Asks
- Market Symbol: baseMint-Quotemint
- Bid: Placing a bid on the above market will use "quoteMint" as input and "baseMint" as output
- Ask: Placing an ask on the above market will use "baseMint" as input and "quoteMint" as output
- Example:
  - Market: SRM-USDT
  - Bid: Input USDT, Output: SRM
  - Ask: Input SRM, Output USDT
 * 
 */

/**
 * if the number of tokens received from the trade is less than the client provided minExchangeRate,
 *  the transaction aborts.
 * If swapping on an illiquid market and the output tokens is less than minExchangeRate,
 *  then the transaction will fail in an attempt to prevent an undesireable outcome.
 * minExchangeRate is the minimum rate used to calculate the number of tokens one should receive for the swap.
 *  This is a safety mechanism to prevent one from performing an unexpecteed trade.
 *
 * Consider the dummy Arb
 * Arbitrage = {
 *  prices: [0.0316816626536561, 31.5852601847056]
 *  volumes:[300.0, 9814935.357628]
 *  amms: [SRM, RAY],
 *  markets: [SOL-USDC, SOL-USDC]
 *  trades: [BID, ASK]
 * }
 *
 * exectution path: [USDC, SOL, USDC]
 * fromMint: USDC
 * toMint: SOL
 * minExchangeRate = (10 ** 9)/(1/0.0316816626536561) * ((100 - slippage)/100) = 31364846.027119539
 * outputVolume_1 = (1 * 31364846.027119539) / 10^9 = 0.031364846 (minimum amount of sol we get for 1 USDC)
 * outputVolume_32 = (32 * 31364846.027119539) / 10^9 = 1.003675073(minumum anount of sol we get for 32 USDC)
 */

export class SerumSwapBuilder implements ISwapBuilder {
    buildSwap(params: SerumSwapParams): SerumSwapCommand {
        const routeFare = 1 / params.routeFare;

        const minExchangeRate = new BN((10 ** params.toToken.decimals / routeFare) * ((100 - params.slippage) / 100));

        const outputVolume: number = (params.inputVolume * minExchangeRate.toNumber()) / 10 ** params.toToken.decimals;

        return {
            fromAta: params.fromAta,
            toAta: params.toAta,
            fromToken: params.fromToken,
            toToken: params.toToken,
            inputAmount: params.inputVolume,
            outputAmount: outputVolume,
            amm: AutomateMarketMakers.SRM,
            minExchangeRate: minExchangeRate,
            openOrderAccount: params.openOrderAccount,
            marketKeys: params.marketKeys,
        };
    }
}

import { Liquidity, Percent, Price, Token, TokenAmount } from "@raydium-io/raydium-sdk";
import { BN } from "bn.js";
import logger from "../logger";
import { AutomateMarketMakers } from "../types";
import { ISwapBuilder, RaydiumSwapCommand, RaydiumSwapParams } from "./types";

/**
 *
 * Raydium Follows the constant product rule which has the invariant
 * baseLiquidity/QuoteLiquitiy = Price
 * in bid case, we receive base liquidity(volume) and price  from the graph
 * in ask case, we receive quote liquidity(volume) and price from the graph
 *
 * We use the constant-product formula to get the estimated output amount
 * Consider the following swap  SOL-USDC.
 *  fromMint: SOL
 *  toMint: USDC
 *  base liquidity: 265040.768636982
 *  quote liquidity: 3855430.984145
 *
 *  inputVolumeWithFee = 0.9975
 *  reserves = [baseLiquidity, quoteLiquidity]
 *  const [reserveIn, reserveOut] = reserves
 *  denominator = reserveIn + inputVolumeWithFee = 265040.768636982 + 0.9975 = 265041.766136982
 *  amountOutRaw reserveOut * (inputVolumeWithFee/denominator) = 3855430.984145 * (0.9975/265041.766136982) = 14.510137262
 *  minAmountOutRaw = amountOutRaw * 0.99 = 14.365035889
 *
 */
export class RaydiumSwapBuilder implements ISwapBuilder {
    buildSwap(params: RaydiumSwapParams): RaydiumSwapCommand {
        let baseLiquidity: number, quoteLiquidity: number;
        const routeFare = 1 / params.price;
        const [baseSymbol, quoteSymbol] = params.marketSymbol.split("-");

        if (baseSymbol === params.fromToken.symbol && quoteSymbol === params.toToken.symbol) {
            // ASK
            quoteLiquidity = params.reserve;
            baseLiquidity = routeFare * quoteLiquidity;
        } else {
            //BID
            baseLiquidity = params.reserve;
            quoteLiquidity = baseLiquidity / routeFare;
        }
        const reserves = [baseLiquidity, quoteLiquidity];
        // if (params.fromToken.symbol === quoteSymbol) {
        // reserves.reverse();
        // }

        const inputTokenAmount = new TokenAmount(
            new Token(params.fromToken.mint, params.fromToken.decimals, params.fromToken.symbol),
            params.inputVolume,
            false,
        );

        const inputTokenAmountWithFee = inputTokenAmount.raw.muln(10000).divn(10000);

        const marketPrice = new Price(
            new Token(params.fromToken.mint, params.fromToken.decimals, params.fromToken.symbol),
            Math.round(reserves[0]),
            new Token(params.toToken.mint, params.toToken.decimals, params.toToken.symbol),
            Math.round(reserves[1]),
        );
        const amountOutRaw = marketPrice.raw.mul(inputTokenAmountWithFee);

        const outputAmountWithoutSlippage = amountOutRaw
            .mul(100)
            .div(100)
            .div(10 ** params.fromToken.decimals);
        // .toFixed(params.toToken.decimals),
        const minAmountOutRaw = amountOutRaw
            .mul(100 - params.slippage)
            .div(100)
            .div(10 ** params.fromToken.decimals);
        // .toFixed(params.toToken.decimals),
        const expectedOutput = Number(
            outputAmountWithoutSlippage.add(minAmountOutRaw).div(2).toFixed(params.toToken.decimals),
        );

        return {
            baseLiquidity: baseLiquidity,
            quoteLiquidity: quoteLiquidity,
            fromAta: params.fromAta,
            toAta: params.toAta,
            fromToken: params.fromToken,
            toToken: params.toToken,
            inputAmount: params.inputVolume,
            outputAmount: expectedOutput,
            amm: AutomateMarketMakers.RAY,
            marketKeys: params.marketKeys,
        };
    }
}

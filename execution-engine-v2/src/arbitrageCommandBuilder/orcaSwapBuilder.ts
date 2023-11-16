import { u64 } from "@solana/spl-token";
import { AutomateMarketMakers } from "../types";
import { getTokens, OrcaU64, Percentage, U64Utils } from "@orca-so/sdk";
import { ISwapBuilder, OrcaSwapCommand, OrcaSwapParams } from "./types";
import { QuoteBuilderFactory, QuotePoolParams } from "@orca-so/sdk/dist/model/quote/quote-builder";

export class OrcaSwapBuilder implements ISwapBuilder {
  
    buildSwap(swapParams: OrcaSwapParams): OrcaSwapCommand {
        const poolParameters = swapParams.poolParameters;
        const { inputPoolToken, outputPoolToken } = getTokens(poolParameters, swapParams.fromToken.mint.toBase58());

        const inputTokenVolume = swapParams.fromTokenVolume;
        const inputTokenVolumeU64 = OrcaU64.fromNumber(inputTokenVolume, inputPoolToken.scale).toU64();

        const outputTokenVolume = swapParams.fromTokenVolume * swapParams.fromTokenPrice;
        const outputTokenVolumeu64 = OrcaU64.fromNumber(outputTokenVolume, outputPoolToken.scale).toU64();

        const feeStructure = poolParameters.feeStructure;
        const slippageTolerance = Percentage.fromFraction(swapParams.slippage, 100);
        const swapAmountU64 = U64Utils.toTokenU64(
            OrcaU64.fromNumber(swapParams.inputVolume, inputPoolToken.scale),
            inputPoolToken,
            "inputAmount",
        );

        const quoteParams: QuotePoolParams = {
            inputToken: inputPoolToken,
            outputToken: outputPoolToken,
            inputTokenCount: inputTokenVolumeU64,
            outputTokenCount: outputTokenVolumeu64,
            feeStructure,
            slippageTolerance,
            lamportsPerSignature: 0,
            amp: poolParameters.amp !== undefined ? new u64(poolParameters.amp) : undefined
        };

        const quoteBuilder = QuoteBuilderFactory.getBuilder(poolParameters.curveType);
        const quote = quoteBuilder!.buildQuote(quoteParams, swapAmountU64);
        const minimumOutputAmount = quote.getMinOutputAmount();
        const expectedOutput = quote.getExpectedOutputAmount();

        return {
            ...swapParams,
            amm: AutomateMarketMakers.ORCA,
            outputAmount: expectedOutput.toNumber(),
            inputAmount: swapParams.inputVolume,
            inputPoolToken: inputPoolToken,
            outputPoolToken: outputPoolToken,
            minimumOutputAmount: minimumOutputAmount
        };
    }
}

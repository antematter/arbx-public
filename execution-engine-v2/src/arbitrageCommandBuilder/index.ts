import { PublicKey } from "@solana/web3.js";
import { OrcaAmm, RaydiumAmm, SerumAmm } from "../amms";
import { IArbExecutionContext } from "../handlers";
import { AssosiatedTokenAccount } from "../tokens";
import { AutomateMarketMakers } from "../types";
import { OrcaSwapBuilder } from "./orcaSwapBuilder";
import { RaydiumSwapBuilder } from "./raydiumSwapBuilder";
import { SerumSwapBuilder } from "./serumSwapLegBuilder";
import { ArbitrageCommand, SwapCommand } from "./types";
import { makeWrapAndUnwrapSolInstruction, needsSolWrapingAndUnwraping, WrapAndUnwrapSolInstruction } from "./utils";

export class ArbitrageCommandBuilder {
    private serumSwapBuilder: SerumSwapBuilder;
    private raydiumSwapBuilder: RaydiumSwapBuilder;
    private orcaSwapBuilder: OrcaSwapBuilder;

    constructor() {
        this.serumSwapBuilder = new SerumSwapBuilder();
        this.raydiumSwapBuilder = new RaydiumSwapBuilder();
        this.orcaSwapBuilder = new OrcaSwapBuilder();
    }

    public async buildArbitrage(ctx: IArbExecutionContext): Promise<ArbitrageCommand> {
        //does this arb contains sol; if yes, build it and if needed add instruction to credit it
        const containsSol = needsSolWrapingAndUnwraping(ctx.arbitrage.legs);
        let wrapAndUnwrapSol: WrapAndUnwrapSolInstruction = {};
        if (containsSol) {
            //adds wrap, credit it if needed and unwrap sol instrs
            const needsCrediting = ctx.arbitrage.legs[0].fromToken.symbol === "sol" ? true : false;
            wrapAndUnwrapSol = await makeWrapAndUnwrapSolInstruction(
                ctx.connection,
                ctx.payer,
                needsCrediting,
                ctx.arbitrage.startAmount,
            );

            ctx.atas.set(
                "sol",
                new AssosiatedTokenAccount(
                    "sol",
                    new PublicKey("So11111111111111111111111111111111111111112"),
                    wrapAndUnwrapSol.solAta!,
                ),
            );
        }

        let inputAmount = ctx.arbitrage.startAmount;
        const slippage = ctx.arbitrage.slippage;

        const swapLegs: Array<SwapCommand> = [];

        for (let i = 0; i < ctx.arbitrage.markets.length; i++) {
            const amm = ctx.arbitrage.amms[i];
            const market = ctx.arbitrage.markets[i];
            const leg = ctx.arbitrage.legs[i];

            const fromAta = ctx.atas.get(ctx.arbitrage.legs[i].fromToken.symbol)!;
            const toAta = ctx.atas.get(ctx.arbitrage.legs[i].toToken.symbol)!;
            const price = ctx.arbitrage.prices[i];

            if (amm === AutomateMarketMakers.SRM) {
                const serumParams = this.serumSwapBuilder.buildSwap({
                    inputVolume: inputAmount,
                    slippage: slippage,
                    fromAta: fromAta,
                    toAta: toAta,
                    fromToken: leg.fromToken,
                    toToken: leg.toToken,
                    routeFare: price,
                    openOrderAccount: ctx.ooAccounts!.get(market)!,
                    marketSymbol: market,
                    marketKeys: (ctx.dataStore.getAmmMarket(amm, market) as SerumAmm).serumMarket,
                });

                inputAmount = serumParams.outputAmount;
                swapLegs.push(serumParams);
            } else if (amm === AutomateMarketMakers.RAY) {
                const rayParams = this.raydiumSwapBuilder.buildSwap({
                    inputVolume: inputAmount,
                    reserve: ctx.arbitrage.volumes[i],
                    price: price,
                    marketSymbol: market,
                    fromAta: fromAta,
                    toAta: toAta,
                    fromToken: leg.fromToken,
                    toToken: leg.toToken,
                    slippage: slippage,
                    marketKeys: (ctx.dataStore.getAmmMarket(amm, market) as RaydiumAmm).marketKeys,
                });

                inputAmount = rayParams.outputAmount;
                swapLegs.push(rayParams);
            } else if (amm === AutomateMarketMakers.ORCA) {
                const orcaParams = this.orcaSwapBuilder.buildSwap({
                    inputVolume: inputAmount,
                    fromTokenVolume: ctx.arbitrage.volumes[i],
                    fromTokenPrice: price,
                    marketSymbol: market,
                    fromAta: fromAta,
                    toAta: toAta,
                    fromToken: leg.fromToken,
                    toToken: leg.toToken,
                    slippage: slippage,
                    poolParameters: (ctx.dataStore.getAmmMarket(amm, market) as OrcaAmm).addresses.poolParameters,
                });

                inputAmount = orcaParams.outputAmount;
                swapLegs.push(orcaParams);
            }
        }

        const firstLeg = swapLegs[0];
        const finalLeg = swapLegs[swapLegs.length - 1];
        const trueProfitPotential = finalLeg.outputAmount / firstLeg.inputAmount;

        return {
            swapLegs: swapLegs,
            luts: ctx.luts,
            wrapSol: wrapAndUnwrapSol.wrapSol,
            unwrapSol: wrapAndUnwrapSol.unwrapSol,
            solAta: wrapAndUnwrapSol.solAta,
            trueProfitPotential: trueProfitPotential,
        };
    }
}

//Arbitrage Instruction Builder
// receives arb commands
// creates swap instructions using it
// return that back to ARb Dispatcher

//ARb Dispatcher
// receives ArbFeed
// passes it through filters
// passes it through handers
// gets ArbitrageCommand from ArbitrageCommandBuilder
// passes ArbitrageCommand to Arbitrage Instruction Builder to get ArbitrageInstructions
// passes that to tx-executor

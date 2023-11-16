import { AddressLookupTableAccount } from "@solana/web3.js";
import { AutomateMarketMakers } from "../types";
import { HandlerResult, IArbExecutionContext, IHandler, ILutContext } from "./types";

interface LutIndex {
    amm: AutomateMarketMakers;
    market: string;
}

export class AddressLookupTableHandler implements IHandler {
    async handle(ctx: ILutContext): Promise<HandlerResult> {
        const lutAccounts: Array<AddressLookupTableAccount> = [];

        const ammMarkets: Array<LutIndex> = [];
        for (let i = 0; i < ctx.arbitrage.amms.length; i++) {
            ammMarkets.push({
                amm: ctx.arbitrage.amms[i],
                market: ctx.arbitrage.markets[i],
            });
        }

        for (let lut of ammMarkets) {
            const lutAccount = ctx.dataStore.getLut(lut.amm, lut.market);
            if (lutAccount) {
                lutAccounts.push(lutAccount);
            } else {
                //need to extend an lut or possibly extend it
                const lutExtensionInstr = await ctx.dataStore.extendLut(lut.amm, lut.market);
                const instrs = [lutExtensionInstr.extendLut];

                if (lutExtensionInstr.createLut) instrs.unshift(lutExtensionInstr.createLut);

                return {
                    status: "NOT_OK",
                    action: instrs,
                    postTxHook: lutExtensionInstr.postTxHook,
                };
            }
        }
        return {
            status: "OK",
            action: {
                ...ctx,
                luts: lutAccounts,
            } as IArbExecutionContext,
        };
    }
}

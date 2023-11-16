import { OpenOrders } from "@project-serum/serum";
import { Keypair, PublicKey } from "@solana/web3.js";
import { SerumAmm } from "../amms";
import { MAINNET_SERUM_DEX_PROGRAM } from "../constants";
import { AutomateMarketMakers, TxInstruction } from "../types";
import { HandlerResult, IArbExecutionContext, IHandler } from "./types";

export class OpenOrdersHandler implements IHandler {
    async handle(ctx: IArbExecutionContext): Promise<HandlerResult> {
        const serumMarkets = [];
        const ooAccounts: Map<string, PublicKey> = new Map();

        for (let i = 0; i < ctx.arbitrage.amms.length; i++) {
            if (ctx.arbitrage.amms[i] === AutomateMarketMakers.SRM) {
                serumMarkets.push(ctx.arbitrage.markets[i]);
            }
        }

        for (let market of serumMarkets) {
            const account = ctx.dataStore.getOpenOrderAccount(market);
            if (account) {
                ooAccounts.set(market, account);
            } else {
                const newOpenOrderAccount = Keypair.generate();
                const ooInstr: TxInstruction = {
                    instruction: await OpenOrders.makeCreateAccountTransaction(
                        ctx.connection,
                        (ctx.dataStore.getAmmMarket(AutomateMarketMakers.SRM, market) as SerumAmm).addresses.ownAddress,
                        ctx.payer.publicKey,
                        newOpenOrderAccount.publicKey,
                        MAINNET_SERUM_DEX_PROGRAM,
                    ),
                    signers: [newOpenOrderAccount],
                };

                return {
                    status: "NOT_OK",
                    action: [ooInstr],
                    postTxHook: async () => {
                        ctx.dataStore.addOpenOrderAccount(market, newOpenOrderAccount.publicKey);
                    },
                };
            }
        }

        return {
            status: "OK",
            action: {
                ...ctx,
                ooAccounts: ooAccounts,
            } as IArbExecutionContext,
        };
    }
}

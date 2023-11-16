import { Datastore } from "../datastore";
import { SUPPORTED_MARKETS } from "../../supported-markets";
import {
    ArbitrageFeed,
    ArbitrageFeedResult,
    ArbitrageLeg,
    AutomateMarketMakers,
    LegacyTransactionWithHooks,
    RawArbitrage,
    TxInstruction,
    VersionedTransactionWithHooks,
} from "../types";
import {
    AddressLookupTableAccount,
    Connection,
    PublicKey,
    Signer,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";

export const makeMarketSymbol = (base: string, quote: string) => {
    return `${base}-${quote}`;
};

const SupportedMarkets = new Set(SUPPORTED_MARKETS.map((market) => market.toLowerCase()));
export function createArbitrageFeed(
    rawArbitrage: RawArbitrage,
    datastore: Datastore,
    startAmount: number,
    slippage: number,
): [ArbitrageFeedResult, ArbitrageFeed | undefined] {
    const trades = rawArbitrage.trades.map((trade) => (trade === "ASK" ? "BID" : "ASK"));
    const arbLegs: ArbitrageLeg[] = [];
    const markets: string[] = [];
    /**
     * Example:
     *   Market: SRM-USDT
     *   Bid: Input USDT, Output: SRM <===> FromToken = USDT, ToToken = SRM
     *   Ask: Input SRM, Output USDT <===> FromToken = SRM, ToToken = USDT
     */
    for (let i = 0; i < rawArbitrage.tokens.length - 1; i++) {
        const tokenA = rawArbitrage.tokens[i].toLowerCase();
        const tokenB = rawArbitrage.tokens[i + 1].toLowerCase();

        if (!datastore.doesTokenExist(tokenA) || !datastore.doesTokenExist(tokenB)) {
            return [ArbitrageFeedResult.InvalidToken, undefined];
        }

        if (
            !SupportedMarkets.has(makeMarketSymbol(tokenA, tokenB)) &&
            !SupportedMarkets.has(makeMarketSymbol(tokenB, tokenA))
        ) {
            return [ArbitrageFeedResult.InvalidMarket, undefined];
        }
        const marketSymbol = SupportedMarkets.has(makeMarketSymbol(tokenA, tokenB))
            ? makeMarketSymbol(tokenA, tokenB)
            : makeMarketSymbol(tokenB, tokenA);

        markets.push(marketSymbol);
        const [baseToken, quoteToken] = marketSymbol.split("-");
        if (trades[i] === "BID") {
            arbLegs.push({
                fromToken: datastore.getTokenInfo(quoteToken),
                toToken: datastore.getTokenInfo(baseToken),
            });
        } else {
            arbLegs.push({
                fromToken: datastore.getTokenInfo(baseToken),
                toToken: datastore.getTokenInfo(quoteToken),
            });
        }
    }
    return [
        ArbitrageFeedResult.Ok,
        {
            amms: rawArbitrage.markets.map((amm) => <AutomateMarketMakers>amm),
            markets: markets,
            slippage: slippage,
            startAmount: startAmount,
            volumes: rawArbitrage.volumes,
            prices: rawArbitrage.prices,
            profitPotential: rawArbitrage.profit_potential,
            legs: arbLegs,
        },
    ];
}

export function buildLegacyTransaction(
    instructions: TxInstruction[],
    preTxHook?: (connection: Connection) => Promise<void>,
    postTxHook?: (connection: Connection, txSig: string) => Promise<void>,
): LegacyTransactionWithHooks {
    const tx = new Transaction();
    const signers: Signer[] = [];
    for (let ix of instructions) {
        tx.add(ix.instruction);
        signers.push(...ix.signers);
    }

    return {
        tx,
        signers,
        preTxHook,
        postTxHook,
    };
}

export async function buildVersionedTransaction(
    connection: Connection,
    instructions: TransactionInstruction[],
    signers: Signer[],
    luts: AddressLookupTableAccount[],
    owner: PublicKey,
    preTxHook?: (connection: Connection) => Promise<void>,
    postTxHook?: (connection: Connection, txSig: string) => Promise<void>,
): Promise<VersionedTransactionWithHooks> {
    const blockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    const message = new TransactionMessage({
        payerKey: owner,
        recentBlockhash: blockhash,
        instructions: instructions,
    }).compileToV0Message(luts);

    const tx = new VersionedTransaction(message);
    return {
        tx,
        signers,
        preTxHook,
        postTxHook,
    };
}

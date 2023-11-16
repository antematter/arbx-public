import { Connection, Transaction, TransactionInstruction, Signer, PublicKey, Keypair } from "@solana/web3.js";
import { Datastore } from "../src/datastore";
import { TokenData } from "../src/tokens";
import { ArbitrageFeed, AutomateMarketMakers } from "../src/types";

export async function sendAndConfirmLegacyTransaction(
    connection: Connection,
    instr: TransactionInstruction,
    signers: Signer[],
) {
    const tx = new Transaction();
    tx.add(instr);
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    tx.sign(...signers);
    const rawTx = tx.serialize();

    while (true) {
        try {
            const txSig = await connection.sendRawTransaction(rawTx);
            await connection.confirmTransaction(txSig);
            break;
        } catch (error) {
            //muting
        }
    }
}

export const DUMMY_ARB: ArbitrageFeed = {
    prices: [3.1220730565095227, 0.394347431655166],
    volumes: [223.6, 0.8459059999999994],
    amms: [<AutomateMarketMakers>"SRM", <AutomateMarketMakers>"RAY"],
    markets: ["usdt-usdc", "usdt-usdc"],
    slippage: 1,
    startAmount: 5,
    profitPotential: 1.23,
    legs: [
        {
            fromToken: new TokenData("usdc", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), 6),
            toToken: new TokenData("usdt", new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), 6),
        },
        {
            fromToken: new TokenData("usdt", new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), 6),
            toToken: new TokenData("usdc", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), 6),
        },
    ],
};

export class TestDataStore extends Datastore {
    constructor(connection: Connection, payer: Keypair, supportedAmms: AutomateMarketMakers[]) {
        super(connection, payer, supportedAmms);
    }

    addDummyToken(tokenSymbol: string, mint: PublicKey, decimals: number) {
        this._tokensInfo.set(tokenSymbol, new TokenData(tokenSymbol, mint, decimals));
    }
    addDummySRMMarket(symbol: string, setOOToNull: boolean = false) {
        const dummyMarket = this._serumAmms.get("usdt-usdc")!;
        if (setOOToNull) dummyMarket.openOrdersAccount = undefined;
        this._serumAmms.set(symbol, dummyMarket);
    }
}

export const TEST_MARKETS = ["USDT-USDC", "SOL-USDC"];
export const TEST_TOKENS = ["USDT", "USDC", "SOL", "SRM"];
export const USDC_TOKEN = new TokenData("usdc", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), 6);
export const USDT_TOKEN = new TokenData("usdt", new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), 6);
export const SOL_TOKEN = new TokenData("sol", new PublicKey("So11111111111111111111111111111111111111112"), 9);
export const SRM_TOKEN = new TokenData("srm", new PublicKey("SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt"), 6);

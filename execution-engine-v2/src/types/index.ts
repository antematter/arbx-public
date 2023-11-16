import { Connection, Signer, Transaction, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { TokenData } from "../tokens";

export enum AutomateMarketMakers {
    SRM = "SRM",
    ORCA = "ORCA",
    RAY = "RAY",
}

export interface TxInstruction {
    instruction: TransactionInstruction;
    signers: Array<Signer>;
}

export interface LegacyTransactionWithHooks {
    preTxHook?: (connection: Connection) => Promise<void>;
    tx: Transaction;
    signers: Signer[];
    postTxHook?: (connection: Connection, txId: string) => Promise<void>;
}

export interface VersionedTransactionWithHooks {
    preTxHook?: (connection: Connection) => Promise<void>;
    tx: VersionedTransaction;
    signers: Signer[];
    postTxHook?: (connection: Connection, txId: string) => Promise<void>;
}

export interface IFileSerializable {
    serializeToFile: () => void;
}

export interface IFileDeserializable {
    deserializeFromFile: () => void;
}

export interface ArbitrageLeg {
    fromToken: TokenData;
    toToken: TokenData;
}

export interface ArbitrageFeed {
    legs: Array<ArbitrageLeg>;
    markets: Array<string>;
    amms: Array<AutomateMarketMakers>;
    volumes: Array<number>;
    prices: Array<number>;
    slippage: number;
    startAmount: number;
    profitPotential: number;
}

export interface RawArbitrage {
    prices: Array<number>;
    volumes: Array<number>;
    tokens: Array<string>;
    markets: Array<string>;
    profit_potential: number;
    timestamp: string;
    trades: Array<string>;
}

export enum ArbitrageFeedResult {
    Ok = "Ok",
    InvalidToken = "InvalidToken",
    InvalidMarket = "InvalidMarket",
}

export interface ArbXConfig {
    privateKey: string;
    targetToken: string;
    slippage: number;
    inputAmount: number;
}

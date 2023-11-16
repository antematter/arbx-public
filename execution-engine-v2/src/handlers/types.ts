import { AddressLookupTableAccount, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Datastore } from "../datastore";
import { AssosiatedTokenAccount } from "../tokens";
import { ArbitrageFeed, TxInstruction } from "../types";

export type HandlerStatus = "OK" | "NOT_OK";

export interface HandlerResult {
    status: HandlerStatus;
    action: TxInstruction[] | IArbContext;
    postTxHook?: () => Promise<void>;
}

export interface IHandler {
    handle(ctx: IArbContext): Promise<HandlerResult>;
}

export interface IArbContext {
    arbitrage: ArbitrageFeed;
    dataStore: Datastore;
    payer: Keypair;
    connection: Connection;
}

export interface ILutContext extends IArbContext {
    atas: Map<string, AssosiatedTokenAccount>;
}

export interface IArbExecutionContext extends ILutContext {
    luts: Array<AddressLookupTableAccount>;
    ooAccounts?: Map<string, PublicKey>;
}

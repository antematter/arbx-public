import { PublicKey } from "@solana/web3.js";
import { TxInstruction } from "../types";

export interface LutExtensionInstruction {
    createLut?: TxInstruction;
    extendLut: TxInstruction;
    postTxHook?: () => Promise<void>;
}

export interface AmmJsonPayload {
    [market: string]: PublicKey;
}
export interface LookupTableJsonPayload {
    [amm: string]: AmmJsonPayload;
}

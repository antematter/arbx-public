import { Signer, TransactionInstruction } from "@solana/web3.js";
import { SwapCommand } from "../arbitrageCommandBuilder/types";
import { TxInstruction } from "../types";

export interface ISwapInstruction {
    buildSwapInstruction(params: SwapCommand): Promise<TxInstruction>;
    load(): Promise<void>;
}

export interface ArbitrageInstruction {
    instructions: TransactionInstruction[];
    signers: Signer[];
}

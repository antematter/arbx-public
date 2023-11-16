import { TxInstruction } from "../types";
import { Keypair } from "@solana/web3.js";
import { ISwapInstruction } from "./types";
import { OrcaSwapCommand } from "../arbitrageCommandBuilder/types";
import { Owner } from "@orca-so/sdk/dist/public/utils/web3/key-utils";
import { OrcaU64, ORCA_TOKEN_SWAP_ID, U64Utils } from "@orca-so/sdk";
import { createSwapInstruction } from "@orca-so/sdk/dist/public/utils/web3/instructions/pool-instructions";

export class OrcaSwapInstructionBuilder implements ISwapInstruction {
    _owner: Owner;
    constructor(payer: Keypair) {
        this._owner = new Owner(payer);
    }

    async buildSwapInstruction(swapParams: OrcaSwapCommand): Promise<TxInstruction> {
        const inputAmountu64 = U64Utils.toTokenU64(
            OrcaU64.fromNumber(swapParams.inputAmount, swapParams.inputPoolToken.scale),
            swapParams.inputPoolToken,
            "inputAmount",
        );

        const swapInstruction = await createSwapInstruction(
            swapParams.poolParameters,
            this._owner,
            swapParams.inputPoolToken,
            swapParams.fromAta.ataAddress,
            swapParams.outputPoolToken,
            swapParams.toAta.ataAddress,
            inputAmountu64,
            swapParams.minimumOutputAmount.toU64(),
            this._owner.publicKey,
            ORCA_TOKEN_SWAP_ID,
        );

        return {
            instruction: swapInstruction.instructions[0],
            signers: [],
        };
    }
    async load(): Promise<void> {}
}

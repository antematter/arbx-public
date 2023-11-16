import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { SPL_ACCOUNT_LAYOUT, TOKEN_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import { Token } from "@solana/spl-token";
import { ArbitrageLeg, TxInstruction } from "../types";

export interface WrapAndUnwrapSolInstruction {
    wrapSol?: TxInstruction[];
    unwrapSol?: TxInstruction;
    solAta?: PublicKey;
}

export async function makeWrapAndUnwrapSolInstruction(
    connection: Connection,
    owner: Keypair,
    needsCrediting: boolean,
    inputAmount: number,
): Promise<WrapAndUnwrapSolInstruction> {
    const balanceNeeded = await connection.getMinimumBalanceForRentExemption(SPL_ACCOUNT_LAYOUT.span, "confirmed");
    const lamports = needsCrediting ? balanceNeeded + inputAmount : balanceNeeded;
    const newAccount = Keypair.generate();

    const createAccountInstr = SystemProgram.createAccount({
        fromPubkey: owner.publicKey,
        newAccountPubkey: newAccount.publicKey,
        lamports: lamports,
        space: SPL_ACCOUNT_LAYOUT.span,
        programId: TOKEN_PROGRAM_ID,
    });

    const initAccountInstr = Token.createInitAccountInstruction(
        TOKEN_PROGRAM_ID,
        new PublicKey("So11111111111111111111111111111111111111112"),
        newAccount.publicKey,
        owner.publicKey,
    );

    const closeSolAta = Token.createCloseAccountInstruction(
        TOKEN_PROGRAM_ID,
        newAccount.publicKey,
        owner.publicKey,
        owner.publicKey,
        [],
    );

    return {
        wrapSol: [
            { instruction: createAccountInstr, signers: [newAccount] },
            { instruction: initAccountInstr, signers: [] },
        ],
        unwrapSol: { instruction: closeSolAta, signers: [] },
        solAta: newAccount.publicKey,
    };
}

export function needsSolWrapingAndUnwraping(legs: ArbitrageLeg[]) {
    for (let leg of legs) {
        if (leg.fromToken.symbol === "sol" || leg.toToken.symbol === "sol") {
            return true;
        }
    }
    return false;
}

import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { AssosiatedTokenAccount } from "../tokens";
import { HandlerResult, IArbContext, IHandler, ILutContext } from "./types";

/** Copied shamelessly from @solana/web3
 * Async version of getAssociatedTokenAddressSync
 * For backwards compatibility
 *
 * @param mint                     Token mint account
 * @param owner                    Owner of the new account
 * @param allowOwnerOffCurve       Allow the owner account to be a PDA (Program Derived Address)
 * @param programId                SPL Token program account
 * @param associatedTokenProgramId SPL Associated Token program account
 *
 * @return Promise containing the address of the associated token account
 */
export async function getAssociatedTokenAddress(
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve = false,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
): Promise<PublicKey> {
    if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBuffer())) throw new Error("TokenOwnerOffCurveError");

    const [address] = await PublicKey.findProgramAddress(
        [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
        associatedTokenProgramId,
    );
    return address;
}

/** Copied shamelessly from @solana/web3
 * Construct an AssociatedTokenAccount instruction
 *
 * @param payer                    Payer of the initialization fees
 * @param associatedToken          New associated token account
 * @param owner                    Owner of the new account
 * @param mint                     Token mint account
 * @param programId                SPL Token program account
 * @param associatedTokenProgramId SPL Associated Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createAssociatedTokenAccountInstruction(
    payer: PublicKey,
    associatedToken: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
): TransactionInstruction {
    const keys = [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: associatedToken, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
        keys,
        programId: associatedTokenProgramId,
        data: Buffer.alloc(0),
    });
}

export class AssociateTokenAccountsHandler implements IHandler {
    async handle(ctx: IArbContext): Promise<HandlerResult> {
        const arbtokens: Set<string> = new Set();

        for (let leg of ctx.arbitrage.legs) {
            arbtokens.add(leg.fromToken.symbol);
            arbtokens.add(leg.toToken.symbol);
        }

        const atas: Map<string, AssosiatedTokenAccount> = new Map();

        for (let tokenSymbol of arbtokens) {
            const ata = ctx.dataStore.getAta(tokenSymbol);
            if (ata) {
                atas.set(tokenSymbol, ata);
            } else {
                // need to create ata
                const tokenAta = await getAssociatedTokenAddress(
                    ctx.dataStore.getTokenInfo(tokenSymbol).mint,
                    ctx.payer.publicKey,
                );
                const createAtaInstr = createAssociatedTokenAccountInstruction(
                    ctx.payer.publicKey,
                    tokenAta,
                    ctx.payer.publicKey,
                    ctx.dataStore.getTokenInfo(tokenSymbol).mint,
                );
                return {
                    status: "NOT_OK",
                    action: [
                        {
                            instruction: createAtaInstr,
                            signers: [],
                        },
                    ],
                    postTxHook: async () => {
                        ctx.dataStore.addAta(tokenSymbol, tokenAta);
                    },
                };
            }
        }
        return {
            status: "OK",
            action: {
                ...ctx,
                atas: atas,
            } as ILutContext,
        };
    }
}

import { RaydiumSwapCommand } from "../arbitrageCommandBuilder/types";
import { TxInstruction } from "../types";
import { ISwapInstruction } from "./types";
import { Liquidity, TokenAmount, Token } from "@raydium-io/raydium-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";

export class RaydiumSwapInstructionBuilder implements ISwapInstruction {
    _owner: PublicKey;
    constructor(payer: Keypair) {
        this._owner = payer.publicKey;
    }
    async buildSwapInstruction(params: RaydiumSwapCommand): Promise<TxInstruction> {
        const tokenAmountIn = new TokenAmount(
            new Token(params.fromToken.mint, params.fromToken.decimals, params.fromToken.symbol),
            params.inputAmount,
            false,
        );

        const tokenAmountOut = new TokenAmount(
            new Token(params.toToken.mint, params.toToken.decimals, params.toToken.symbol),
            params.outputAmount,
            false,
        );

        const swapInstruction = Liquidity.makeSwapInstruction({
            poolKeys: params.marketKeys,
            userKeys: {
                tokenAccountIn: params.fromAta.ataAddress,
                tokenAccountOut: params.toAta.ataAddress,
                owner: this._owner,
            },
            amountIn: tokenAmountIn.raw,
            amountOut: tokenAmountOut.raw,
            fixedSide: "in",
        });

        return {
            instruction: swapInstruction,
            signers: [],
        };
    }
    async load(): Promise<void> {}
}

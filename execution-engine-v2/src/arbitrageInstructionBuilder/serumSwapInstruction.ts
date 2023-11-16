import { AnchorProvider, Wallet } from "@project-serum/anchor";
import { Swap } from "@project-serum/swap";
import { TokenListContainer, TokenListProvider } from "@solana/spl-token-registry";
import { Connection, Keypair } from "@solana/web3.js";
import { SerumSwapCommand } from "../arbitrageCommandBuilder/types";
import { TxInstruction } from "../types";
import { ISwapInstruction } from "./types";
import { TokenAmount, Token } from "@raydium-io/raydium-sdk";

export class SerumSwapInstructionBuilder implements ISwapInstruction {
    _provider: AnchorProvider;
    _tokenList!: TokenListContainer;
    _swapClient!: Swap;

    constructor(connection: Connection, payer: Keypair) {
        this._provider = new AnchorProvider(connection, new Wallet(payer), {
            preflightCommitment: "confirmed",
            commitment: "confirmed",
        });
    }

    async buildSwapInstruction(params: SerumSwapCommand): Promise<TxInstruction> {
        const inputAmount = new TokenAmount(
            new Token(params.fromToken.mint, params.fromToken.decimals, params.fromToken.symbol),
            params.inputAmount,
            false,
        );

        const swapTx = await this._swapClient.swapTxs({
            fromMint: params.fromToken.mint,
            toMint: params.toToken.mint,
            amount: inputAmount.raw,
            minExchangeRate: {
                rate: params.minExchangeRate,
                fromDecimals: params.fromToken.decimals,
                quoteDecimals: params.toToken.decimals,
                strict: true,
            },
            fromMarket: params.marketKeys,
            fromOpenOrders: params.openOrderAccount!,
            fromWallet: params.fromAta.ataAddress,
            toWallet: params.toAta.ataAddress,
        });

        return {
            instruction: swapTx[0].tx.instructions[0],
            signers: [],
        };
    }
    async load(): Promise<void> {
        this._tokenList = await new TokenListProvider().resolve();
        this._swapClient = new Swap(this._provider, this._tokenList);
    }
}

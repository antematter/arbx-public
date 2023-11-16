import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { AssosiatedTokenAccount, TokenData } from ".";
import { SPL_ACCOUNT_LAYOUT } from "@raydium-io/raydium-sdk";
import logger from "../logger";
import { IAssosiatedTokenAccountDataLoader } from "./types";

/**
 * Fetches Associated Token Accounts for the user
 */
export class AssosiatedTokenAccountLoader implements IAssosiatedTokenAccountDataLoader {
    public connection: Connection;
    public owner: PublicKey;

    constructor(connection: Connection, owner: PublicKey) {
        this.connection = connection;
        this.owner = owner;
    }

    async load(supportedTokens: Map<string, TokenData>): Promise<Map<string, AssosiatedTokenAccount>> {
        const atas: Map<string, AssosiatedTokenAccount> = new Map();
        //As SOL's ata will be create and delete in every arb tx, we just add a dummy sol ata here
        atas.set(
            "sol",
            new AssosiatedTokenAccount(
                "sol",
                new PublicKey("So11111111111111111111111111111111111111112"),
                PublicKey.default,
            ),
        );
        const tokenResp = await this.connection.getTokenAccountsByOwner(this.owner, {
            programId: TOKEN_PROGRAM_ID,
        });

        for (let [symbol, token] of supportedTokens) {
            const spl_account = tokenResp.value.filter((acc) =>
                SPL_ACCOUNT_LAYOUT.decode(acc.account.data).mint.equals(token.mint),
            );
            if (spl_account.length === 1) {
                atas.set(symbol, new AssosiatedTokenAccount(symbol, token.mint, spl_account[0].pubkey));
            } else {
                logger.warn(`Associated Token Account does not exist for: ${symbol}`);
            }
        }

        const atasLoaded = new Set([...atas.keys()]);
        const absentAtas = [...supportedTokens.keys()].filter((token) => !atasLoaded.has(token));

        if (absentAtas.length > 0) {
            logger.warn(`Number of Associated Token Accounts not present: ${absentAtas.length}`);
        }

        logger.info(`Associated Token Accounts Loaded: ${atas.size}/${supportedTokens.size}`);
        return atas;
    }
}

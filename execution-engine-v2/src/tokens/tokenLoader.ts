import { TokenData } from ".";
import logger from "../logger";
import fetch from "cross-fetch";
import { PublicKey } from "@solana/web3.js";
import { ITokenDataLoader } from "./types";
import tokensJSON from "../../cache/tokens.json";

/**
 * Fetches tokens metadata from https://cache.jup.ag/tokens
 * Tokens that we fetch are case sensitive and are converted
 * to lower case in datastore after all of them have been loaded
 */
export class TokenDataLoader implements ITokenDataLoader {
    async load(supportedTokens: Set<string>): Promise<Map<string, TokenData>> {
        const tokens: Map<string, TokenData> = new Map();

        let rawTokens;
        try {
            rawTokens = await (await fetch("https://cache.jup.ag/tokens")).json();
        } catch (err) {
            logger.warn(`Failed to load tokens from https://cache.jup.ag/tokens:${err}`);
            logger.info("Loading tokens from cache");
            rawTokens = tokensJSON;
        }

        for (let token of rawTokens) {
            if (token["chainId"] === 101) {
                const tokenSymbol = token["symbol"];
                if (supportedTokens.has(tokenSymbol)) {
                    const tokenMint = new PublicKey(token["address"]);
                    const decimals = token["decimals"];
                    tokens.set(tokenSymbol, new TokenData(tokenSymbol, tokenMint, decimals));
                }
            }
        }
        if (supportedTokens.has("xCOPE")) {
            tokens.set(
                "xCOPE",
                new TokenData("xCOPE", new PublicKey("3K6rftdAaQYMPunrtNRHgnK2UAtjm2JwyT2oCiTDouYE"), 1),
            );
            tokens.set("BTC", new TokenData("BTC", new PublicKey("9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E"), 6));
        }

        const tokens_loaded = new Set([...tokens.keys()]);
        const absentTokens = [...supportedTokens].filter((symbol) => {
            return !tokens_loaded.has(symbol);
        });

        for (let at of absentTokens) {
            logger.warn(`Could not fetch metadata for token: ${at}`);
        }

        if (absentTokens.length > 0) logger.warn(`Number of tokens not found: ${absentTokens.length}`);

        logger.info(`Tokens Loaded: ${tokens.size}/${supportedTokens.size}`);
        return tokens;
    }
}

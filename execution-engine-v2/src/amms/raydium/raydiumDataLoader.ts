import { jsonInfo2PoolKeys, Liquidity, LiquidityPoolKeys, LiquidityPoolKeysV4 } from "@raydium-io/raydium-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import fetch from "cross-fetch";
import { IAmmDataLoader, IDataLoaderParams } from "../types";
import { FilterWrtLiquidityPolicy, RaydiumFactoryParams } from "./types";
import { TokenData } from "../../tokens";
import { makeMarketSymbolFromMints } from "../utils";
import logger from "../../logger";
import { BN } from "bn.js";

function getIndexOfMaxliquidity(liquidities: string[]) {
    let maxBN = new BN(0);
    let maxBNIndex = 0;
    for (let i = 0; i < liquidities.length; i++) {
        if (maxBN.gt(new BN(liquidities[i]))) {
            maxBNIndex = i;
            maxBN = new BN(liquidities[i]);
        }
    }
    return maxBNIndex;
}
export class RaydiumDataLoader implements IAmmDataLoader, FilterWrtLiquidityPolicy {
    tokensData: Map<string, TokenData>;
    connection: Connection;
    owner: PublicKey;

    constructor(params: IDataLoaderParams) {
        this.tokensData = params.tokenData;
        this.connection = params.connection;
        this.owner = params.owner;
    }

    async filterWrtLiquidity(
        possibleMarkets: Map<string, LiquidityPoolKeysV4[]>,
    ): Promise<Map<string, LiquidityPoolKeysV4>> {
        const result: Map<string, LiquidityPoolKeysV4> = new Map();

        for (let [symbol, markets] of possibleMarkets) {
            if (markets.length > 1) {
                logger.warn(`Markets found on Raydium for ${symbol}: ${markets.length}`);
                const liquidities = await Promise.all(
                    markets.map(async (market) => {
                        const poolInfo = await Liquidity.fetchInfo({ connection: this.connection, poolKeys: market });
                        return poolInfo.baseReserve.mul(poolInfo.quoteReserve).toString();
                    }),
                );
                const maxLiquidityMarketIndex = getIndexOfMaxliquidity(liquidities);
                result.set(symbol, markets[maxLiquidityMarketIndex]);
            } else {
                result.set(symbol, markets[0]);
            }
        }

        return result;
    }
    async load(supportedMarkets: Array<string>): Promise<RaydiumFactoryParams> {
        //fetching all raydium pools and keeping only those who tokens we support
        const allPoolsKeys = (await fetchAllPoolKeys()).filter((pool) => {
            const [status, marketMeta] = makeMarketSymbolFromMints(
                pool.baseMint.toString(),
                pool.quoteMint.toString(),
                this.tokensData,
            );
            if (status === "BaseTokenNotFound") {
                if (process.env.LOGGING_LEVEL === "VERBOSE") {
                    // logger.warn(
                    //     `Skipping raydium market because base token does not exist in our system: ${pool.id.toString()}`,
                    // );
                }
                return false;
            } else if (status === "QuoteTokenNotFound") {
                if (process.env.LOGGING_LEVEL === "VERBOSE") {
                    // logger.warn(
                    //     `Skipping raydium market because quote token does not exist in our system: ${pool.id.toString()}`,
                    // );
                }
                return false;
            } else {
                return true;
            }
        });

        // populating a map of market symbols against pools. On raydium, there can be multiple pools
        // against a single symbol. Whenever a symbol has multiple pools, we will pick the one having
        // highest liquidity
        const candidateMarkets: Map<string, LiquidityPoolKeysV4[]> = new Map();
        for (const pool of allPoolsKeys) {
            const [_, marketMeta] = makeMarketSymbolFromMints(
                pool.baseMint.toString(),
                pool.quoteMint.toString(),
                this.tokensData,
            );
            if (supportedMarkets.includes(marketMeta.symbol)) {
                if (candidateMarkets.has(marketMeta.symbol)) {
                    candidateMarkets.get(marketMeta.symbol)!.push(pool);
                } else {
                    candidateMarkets.set(marketMeta.symbol, [pool]);
                }
            }
        }

        const filteredMarkets = await this.filterWrtLiquidity(candidateMarkets);

        const marketsLoaded = new Set([...filteredMarkets.keys()]);
        const absentMarkets = supportedMarkets.filter((market) => !marketsLoaded.has(market));

        if (absentMarkets.length > 0)
            logger.warn(`Number of raydium markets that could not be loaded: ${absentMarkets.length}`);

        logger.warn(`Following raydium markets were not loaded`);
        for (let am of absentMarkets) {
            logger.warn(`❌  ${am}`);
        }
        logger.info(`Raydium Markets Loaded: ${filteredMarkets.size}/${supportedMarkets.length}`);

        return {
            poolsKeys: filteredMarkets,
            supportedTokens: this.tokensData,
        };
    }
}

async function fetchAllPoolKeys(): Promise<LiquidityPoolKeys[]> {
    const response = await fetch("https://api.raydium.io/v2/sdk/liquidity/mainnet.json");
    if (!response.ok) return [];
    const json = await response.json();
    const poolsKeysJson = [...json!.official!, ...json!.unOfficial];
    const poolsKeys = poolsKeysJson.map((item) => {
        const {
            id,
            baseMint,
            quoteMint,
            lpMint,
            baseDecimals,
            quoteDecimals,
            lpDecimals,
            version,
            programId,
            authority,
            openOrders,
            targetOrders,
            baseVault,
            quoteVault,
            withdrawQueue,
            lpVault,
            marketVersion,
            marketProgramId,
            marketId,
            marketAuthority,
            marketBaseVault,
            marketQuoteVault,
            marketBids,
            marketAsks,
            marketEventQueue,
        } = jsonInfo2PoolKeys(item);
        return {
            id,
            baseMint,
            quoteMint,
            lpMint,
            baseDecimals,
            quoteDecimals,
            lpDecimals,
            version,
            programId,
            authority,
            openOrders,
            targetOrders,
            baseVault,
            quoteVault,
            withdrawQueue,
            lpVault,
            marketVersion,
            marketProgramId,
            marketId,
            marketAuthority,
            marketBaseVault,
            marketQuoteVault,
            marketBids,
            marketAsks,
            marketEventQueue,
        };
    });
    return poolsKeys;
}

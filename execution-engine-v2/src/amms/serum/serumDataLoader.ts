import { Connection, PublicKey } from "@solana/web3.js";
import { Market, OpenOrders } from "@project-serum/serum";
import fetch from "cross-fetch";
import { IAmmDataLoader, IDataLoaderParams } from "../types";
import { SerumFactoryParams, SerumMarketMeta } from "./types";
import { MAINNET_SERUM_DEX_PROGRAM } from "../../constants";
import { TokenData } from "../../tokens";
import { makeMarketSymbolFromMints } from "../utils";
import logger from "../../logger";
import serumMarketsJSON from "../../../cache/serumMarkets.json";

interface RawMarket {
    data: Buffer;
    executable: boolean;
    lamports: number;
    owner: PublicKey;
    rentEpoch: number;
    pubkey: number;
}

function decodeRawSerumMarket(marketsCache: Array<any>): Array<RawMarket> {
    return marketsCache.map((market) => {
        const {
            data: [accountInfo, format],
            pubkey,
            ...rest
        } = market;
        return {
            ...rest,
            pubkey: new PublicKey(pubkey),
            data: Buffer.from(accountInfo, format),
            owner: new PublicKey(rest.owner),
        };
    });
}

export class SerumDataLoader implements IAmmDataLoader {
    tokensData: Map<string, TokenData>;
    connection: Connection;
    owner: PublicKey;
    constructor(params: IDataLoaderParams) {
        this.tokensData = params.tokenData;
        this.connection = params.connection;
        this.owner = params.owner;
    }

    async load(supportedMarkets: Array<string>): Promise<SerumFactoryParams> {
        const serumMarkets: Map<string, SerumMarketMeta> = new Map();
        const openOrdersAddresses = new Map<string, OpenOrders>();

        // fetching open orders
        const allOpenOrders = await OpenOrders.findForOwner(this.connection, this.owner, MAINNET_SERUM_DEX_PROGRAM);

        let rawSerumMarkets;
        try {
            rawSerumMarkets = (await (await fetch("https://cache.jup.ag/markets?v=3")).json()) as Array<any>;
        } catch (err) {
            logger.warn(`Failed to load Serum markets from https://cache.jup.ag/markets?v=3: ${err}`);
            logger.info("Loading Serum markets from cache");
            rawSerumMarkets = serumMarketsJSON as Array<any>;
        }
        rawSerumMarkets = rawSerumMarkets.filter((market) => {
            return market.owner === MAINNET_SERUM_DEX_PROGRAM.toString();
        });
        const decodedSerumMarkets = decodeRawSerumMarket(rawSerumMarkets);

        for (let decodedMarket of decodedSerumMarkets) {
            const decoded = Market.getLayout(MAINNET_SERUM_DEX_PROGRAM).decode(decodedMarket.data);
            const baseMint: string = decoded["baseMint"].toString();
            const quoteMint: string = decoded["quoteMint"].toString();

            const [status, marketSymbol] = makeMarketSymbolFromMints(baseMint, quoteMint, this.tokensData);

            if (status === "BaseTokenNotFound") {
                if (process.env.LOGGING_LEVEL === "VERBOSE") {
                    // logger.warn(
                    //     `Skipping serum market because base token does not exist in our system: ${decoded.ownAddress}`,
                    // );
                }
                continue;
            } else if (status === "QuoteTokenNotFound") {
                if (process.env.LOGGING_LEVEL === "VERBOSE") {
                    // logger.warn(
                    //     `Skipping serum market because quote token does not exist in our system: ${decoded.ownAddress}`,
                    // );
                }
                continue;
            } else {
                if (supportedMarkets.includes(marketSymbol.symbol)) {
                    serumMarkets.set(marketSymbol.symbol, {
                        marketLayout: decoded,
                        marketMeta: marketSymbol,
                    });
                    const ooAddress = allOpenOrders.filter(
                        (oo) => oo.market.toString() === decoded["ownAddress"].toString(),
                    );
                    if (ooAddress.length !== 0) {
                        openOrdersAddresses.set(marketSymbol.symbol, ooAddress[0]);
                    } else {
                        logger.warn(`Serum Open order account does not exist for market: ${marketSymbol.symbol}`);
                    }
                }
            }
        }
        const marketsLoaded = new Set([...serumMarkets.keys()]);
        const absentMarkets = supportedMarkets.filter((market) => !marketsLoaded.has(market));

        if (absentMarkets.length > 0)
            logger.warn(`Number of Serum markets that could not be loaded: ${absentMarkets.length}`);
        logger.warn(`Following serum markets were not loaded`);
        for (let am of absentMarkets) {
            logger.warn(`❌  ${am}`);
        }
        logger.info(`Serum Markets Loaded: ${serumMarkets.size}/${supportedMarkets.length}`);

        return {
            rawSerumMarkets: serumMarkets,
            openOrderAccounts: openOrdersAddresses,
            supportedTokens: this.tokensData,
        };
    }
}

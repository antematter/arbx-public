import { Connection, PublicKey } from "@solana/web3.js";
import { TokenData } from "../tokens";

export interface IAmmMarketAddresses {}
/**
 * Interface to abstract away addresses associated with a dex or any amm.
 * Other related addresses like open orders and metadata can go inside classes implementing this interface
 */
export interface IAutomatedMarketMaker {
    addresses: IAmmMarketAddresses;
    symbol: string;
    getAllAddresses(): Array<PublicKey>;
}

export interface IAmmMarket {
    baseToken: TokenData;
    quoteToken: TokenData;
    symbol: string;
}

export interface IAmmFactory {
    create(params: IAmmFactoryParams): Promise<Map<string, IAutomatedMarketMaker>>;
}

export interface IAmmFactoryParams {}
export interface IAmmDataLoader {
    load(supportedMarkets: Array<string>): Promise<IAmmFactoryParams>;
}

export interface IDataLoaderParams {
    connection: Connection;
    tokenData: Map<string, TokenData>;
    owner: PublicKey;
}

export type MarketStatus = "OK" | "BaseTokenNotFound" | "QuoteTokenNotFound";

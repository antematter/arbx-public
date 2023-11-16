import { OpenOrders } from "@project-serum/serum";
import { PublicKey } from "@solana/web3.js";
import { TokenData } from "../../tokens";
import { IAmmFactoryParams, IAmmMarket, IAmmMarketAddresses } from "../types";

export interface SerumMarketAddresses extends IAmmMarketAddresses {
    ownAddress: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    requestQueue: PublicKey;
    eventQueue: PublicKey;
    bids: PublicKey;
    asks: PublicKey;
    vaultSigner: PublicKey;
}

export interface SerumMarketMeta {
    marketLayout: any;
    marketMeta: IAmmMarket;
}

export interface SerumFactoryParams extends IAmmFactoryParams {
    rawSerumMarkets: Map<string, SerumMarketMeta>;
    openOrderAccounts: Map<string, OpenOrders>;
    supportedTokens: Map<string, TokenData>;
}

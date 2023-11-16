import { PublicKey } from "@solana/web3.js";
import { TokenData } from "../../tokens";
import { LiquidityPoolKeys, LiquidityPoolKeysV4 } from "@raydium-io/raydium-sdk";
import { IAmmFactoryParams, IAmmMarketAddresses } from "../types";

export interface RaydiumMarketAddresses extends IAmmMarketAddresses {
    id: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    lpMint: PublicKey;
    programId: PublicKey;
    authority: PublicKey;
    openOrders: PublicKey;
    targetOrders: PublicKey;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    withdrawQueue: PublicKey;
    lpVault: PublicKey;
    marketProgramId: PublicKey;
    marketId: PublicKey;
    marketAuthority: PublicKey;
    marketBaseVault: PublicKey;
    marketQuoteVault: PublicKey;
    marketBids: PublicKey;
    marketAsks: PublicKey;
    marketEventQueue: PublicKey;
}

export interface RaydiumFactoryParams extends IAmmFactoryParams {
    poolsKeys: Map<string, LiquidityPoolKeys>;
    supportedTokens: Map<string, TokenData>;
}

export interface FilterWrtLiquidityPolicy {
    filterWrtLiquidity(possibleMarkets: Map<string, LiquidityPoolKeysV4[]>): Promise<Map<string, LiquidityPoolKeysV4>>;
}

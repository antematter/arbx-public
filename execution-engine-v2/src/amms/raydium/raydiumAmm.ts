import { PublicKey } from "@solana/web3.js";
import { LiquidityPoolKeys } from "@raydium-io/raydium-sdk";
import { IAutomatedMarketMaker } from "../types";
import { RaydiumMarketAddresses } from "./types";

export class RaydiumAmm implements IAutomatedMarketMaker {
    symbol: string;
    addresses: RaydiumMarketAddresses;
    marketKeys: LiquidityPoolKeys;

    constructor(symbol: string, marketKeys: LiquidityPoolKeys) {
        this.symbol = symbol;
        this.marketKeys = marketKeys;
        this.addresses = {
            id: this.marketKeys.id,
            baseMint: this.marketKeys.baseMint,
            quoteMint: this.marketKeys.quoteMint,
            lpMint: this.marketKeys.lpMint,
            programId: this.marketKeys.programId,
            authority: this.marketKeys.authority,
            openOrders: this.marketKeys.openOrders,
            targetOrders: this.marketKeys.targetOrders,
            baseVault: this.marketKeys.baseVault,
            quoteVault: this.marketKeys.quoteVault,
            withdrawQueue: this.marketKeys.withdrawQueue,
            lpVault: this.marketKeys.lpVault,
            marketProgramId: this.marketKeys.marketProgramId,
            marketId: this.marketKeys.marketId,
            marketAuthority: this.marketKeys.marketAuthority,
            marketBaseVault: this.marketKeys.marketBaseVault,
            marketQuoteVault: this.marketKeys.marketQuoteVault,
            marketBids: this.marketKeys.marketBids,
            marketAsks: this.marketKeys.marketAsks,
            marketEventQueue: this.marketKeys.marketEventQueue,
        };
    }

    getAllAddresses(): PublicKey[] {
        return [...Object.values(this.addresses)];
    }
}

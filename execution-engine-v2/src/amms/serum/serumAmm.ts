import { PublicKey } from "@solana/web3.js";
import { Market } from "@project-serum/serum";

import { IAutomatedMarketMaker } from "../types";
import { MAINNET_SERUM_DEX_PROGRAM } from "../../constants";
import { SerumMarketAddresses } from "./types";
import BN from "bn.js";

function getVaultOwnerAndNonce(marketAddress: PublicKey, dexProgramId: PublicKey) {
    const nonce = new BN(0);
    while (nonce.toNumber() < 255) {
        try {
            const vaultOwner = PublicKey.createProgramAddressSync(
                [marketAddress.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
                dexProgramId,
            );
            return vaultOwner;
        } catch (e) {
            nonce.iaddn(1);
        }
    }
    throw new Error("Unable to find nonce");
}
export class SerumAmm implements IAutomatedMarketMaker {
    symbol: string;
    addresses: SerumMarketAddresses;
    serumMarket: Market;
    openOrdersAccount?: PublicKey;

    constructor(
        symbol: string,
        marketLayout: any,
        baseDecimals: number,
        quoteDecimals: number,
        openOrderAcc?: PublicKey,
    ) {
        this.symbol = symbol;
        this.serumMarket = new Market(marketLayout, baseDecimals, quoteDecimals, undefined, MAINNET_SERUM_DEX_PROGRAM);
        this.openOrdersAccount = openOrderAcc;
        const marketAddrs = JSON.parse(JSON.stringify(this.serumMarket))["_decoded"];
        this.addresses = {
            ownAddress: new PublicKey(marketAddrs.ownAddress),
            baseMint: new PublicKey(marketAddrs.baseMint),
            quoteMint: new PublicKey(marketAddrs.quoteMint),
            baseVault: new PublicKey(marketAddrs.baseVault),
            quoteVault: new PublicKey(marketAddrs.quoteVault),
            requestQueue: new PublicKey(marketAddrs.requestQueue),
            eventQueue: new PublicKey(marketAddrs.eventQueue),
            bids: new PublicKey(marketAddrs.bids),
            asks: new PublicKey(marketAddrs.asks),
            vaultSigner: getVaultOwnerAndNonce(new PublicKey(marketAddrs.ownAddress), MAINNET_SERUM_DEX_PROGRAM),
        };
    }

    getAllAddresses(): PublicKey[] {
        const allAddrs = [...Object.values(this.addresses)];
        if (this.openOrdersAccount) allAddrs.push(this.openOrdersAccount!);
        return allAddrs;
    }

    updateOpenOrdersAccount(ooAccount: PublicKey) {
        if (!this.openOrdersAccount) this.openOrdersAccount = ooAccount;
    }
}

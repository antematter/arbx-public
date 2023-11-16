import { Datastore } from "../datastore";
import { ArbitrageFeed } from "../types";
import { IArbitrageFilter } from "./interface";

export class MarketFilter implements IArbitrageFilter {
    datastore: Datastore;

    constructor(ds: Datastore) {
        this.datastore = ds;
    }

    filter(arbitrage: ArbitrageFeed): boolean {
        let hasAllMarkets = true;
        for (let i = 0; i < arbitrage.amms.length; i++) {
            const amm = arbitrage.amms[i];
            const market = arbitrage.markets[i];

            if (!this.datastore.hasMarket(amm, market)) {
                hasAllMarkets = false;
            }
        }
        return hasAllMarkets;
    }
}

import { Datastore } from "../datastore";
import { ArbitrageFeed } from "../types";
import { IArbitrageFilter } from "./interface";

export class AmmFilter implements IArbitrageFilter {
    private datastore: Datastore;

    constructor(ds: Datastore) {
        this.datastore = ds;
    }

    filter(arbitrage: ArbitrageFeed): boolean {
        const supportedAmms = new Set(this.datastore.supportedAmms);
        const missingAmms = arbitrage.amms.filter((amm) => !supportedAmms.has(amm));
        return missingAmms.length === 0 ? true : false;
    }
}

import { ArbitrageFeed } from "../types";
import { IArbitrageFilter } from "./interface";

export class ProfitPotentialFilter implements IArbitrageFilter {
    minProfitPotential: number;

    constructor(minProfitPotential: number) {
        this.minProfitPotential = minProfitPotential;
    }

    filter(arbitrage: ArbitrageFeed): boolean {
        return arbitrage.profitPotential >= this.minProfitPotential ? true : false;
    }
}

import { ArbitrageFeed } from "../types";

export interface IArbitrageFilter {
    filter(arbitrage: ArbitrageFeed): boolean;
}

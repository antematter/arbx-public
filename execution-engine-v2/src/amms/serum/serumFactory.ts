import { SerumAmm } from "../../amms";
import { IAmmFactory } from "../types";
import { SerumFactoryParams } from "./types";

export class SerumFactory implements IAmmFactory {
    async create(params: SerumFactoryParams): Promise<Map<string, SerumAmm>> {
        const serumMarkets = new Map<string, SerumAmm>();
        for (let [_, market] of params.rawSerumMarkets) {
            const ammMarket = new SerumAmm(
                market.marketMeta.symbol,
                market.marketLayout,
                market.marketMeta.baseToken.decimals,
                market.marketMeta.quoteToken.decimals,
                params.openOrderAccounts.get(market.marketMeta.symbol)?.address,
            );

            serumMarkets.set(market.marketMeta.symbol, ammMarket);
        }
        return serumMarkets;
    }
}

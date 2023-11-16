import { RaydiumAmm } from "..";
import { RaydiumFactoryParams } from "./types";
import { IAmmFactory } from "../types";

export class RaydiumFactory implements IAmmFactory {
    async create(params: RaydiumFactoryParams): Promise<Map<string, RaydiumAmm>> {
        const raydiumMarkets = new Map<string, RaydiumAmm>();

        for (let [symbol, market] of params.poolsKeys) {
            const rayMarket = new RaydiumAmm(symbol, market);
            raydiumMarkets.set(symbol, rayMarket);
        }
        return raydiumMarkets;
    }
}

import { OrcaAmm } from "./orcaAmm";
import { IAmmFactory } from "../types";
import { OrcaFactoryParams } from "./types";

export class OrcaFactory implements IAmmFactory {
    async create(params: OrcaFactoryParams): Promise<Map<string, OrcaAmm>> {
        const orcaMarkets = new Map<string, OrcaAmm>();

        for (let [symbol, poolParams] of params.allPoolParameters) {
            const orcaMarket = new OrcaAmm(symbol, poolParams);
            orcaMarkets.set(symbol, orcaMarket);
        }
        return orcaMarkets;
    }
}

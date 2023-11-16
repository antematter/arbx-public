import logger from "../../logger";
import { OrcaPoolConfig } from "@orca-so/sdk";
import { IAmmDataLoader } from "../types";
import { OrcaFactoryParams } from "./types";
import { orcaPoolConfigs } from "@orca-so/sdk/dist/constants";
import { OrcaPoolParams } from "@orca-so/sdk/dist/model/orca/pool/pool-types";

export class OrcaDataLoader implements IAmmDataLoader {
    async load(supportedMarkets: Array<string>): Promise<OrcaFactoryParams> {
        const poolParameters: Map<string, OrcaPoolParams> = new Map();

        for (let [marketSymbol, mintAddress] of Object.entries(OrcaPoolConfig)) {
            marketSymbol = marketSymbol.replace("_", "-");
            const poolParams = orcaPoolConfigs[mintAddress];
            if (supportedMarkets.includes(marketSymbol)) {
                poolParameters.set(marketSymbol, poolParams);
            }
        }
        logger.info(`Orca Markets Loaded: ${poolParameters.size}/${supportedMarkets.length}`);
        return { allPoolParameters: poolParameters };
    }
}

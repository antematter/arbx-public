import { IAmmFactoryParams, IAmmMarketAddresses } from "../types";
import { OrcaPoolParams } from "@orca-so/sdk/dist/model/orca/pool/pool-types";

export interface OrcaMarketAddresses extends IAmmMarketAddresses {
    poolParameters: OrcaPoolParams;
}

export interface OrcaFactoryParams extends IAmmFactoryParams {
    allPoolParameters: Map<string, OrcaPoolParams>;
}

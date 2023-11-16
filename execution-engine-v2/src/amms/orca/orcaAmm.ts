import { PublicKey } from "@solana/web3.js";
import { OrcaMarketAddresses } from "./types";
import { IAutomatedMarketMaker } from "../types";
import { OrcaPoolParams } from "@orca-so/sdk/dist/model/orca/pool/pool-types";

export class OrcaAmm implements IAutomatedMarketMaker {
    symbol: string;
    addresses: OrcaMarketAddresses;

    constructor(symbol: string, poolParameters: OrcaPoolParams) {
        this.symbol = symbol;
        this.addresses = { poolParameters };
    }

    getAllAddresses(): PublicKey[] {
        return [...Object.values(this.addresses)];
    }
}

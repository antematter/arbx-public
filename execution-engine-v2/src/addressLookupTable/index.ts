import { Connection, PublicKey, AddressLookupTableAccount } from "@solana/web3.js";
import { AutomateMarketMakers, IFileDeserializable, IFileSerializable } from "../types";
import { AddressLookupTableManager } from "./addressLookupTableManager";
import { LookupTableJsonPayload, LutExtensionInstruction } from "./types";
import fs from "fs";
import { LUTS_FILE_CACHE } from "../constants";

export class AddressLookupTableStore implements IFileSerializable, IFileDeserializable {
    lutManager: AddressLookupTableManager;
    cacheStore: string;

    constructor(
        connection: Connection,
        payer: PublicKey,
        supportedAmms: AutomateMarketMakers[],
        cacheStore: string = LUTS_FILE_CACHE,
    ) {
        this.lutManager = new AddressLookupTableManager(connection, payer, supportedAmms);
        this.cacheStore = cacheStore;
    }

    getLut(amm: AutomateMarketMakers, marketSymbol: string): AddressLookupTableAccount | undefined {
        return this.lutManager.getLut(amm, marketSymbol);
    }

    async extendLut(
        amm: AutomateMarketMakers,
        marketSymbol: string,
        addresses: Array<PublicKey>,
    ): Promise<LutExtensionInstruction> {
        let res = await this.lutManager.extendLut(amm, marketSymbol, addresses);
        return {
            createLut: res.createLut,
            extendLut: res.extendLut,
            postTxHook: async () => {
                if (res.postTxHook) {
                    await res!.postTxHook();
                }
                this.serializeToFile();
            },
        };
    }

    serializeToFile() {
        const lutPayload: LookupTableJsonPayload = {};
        for (let amm of Object.keys(AutomateMarketMakers)) {
            lutPayload[amm] = {
                ...Object.fromEntries(
                    [...this.lutManager.ammLutStore.get(amm)!.entries()].map(([key, lut]) => [key, lut.key]),
                ),
            };
        }
        fs.writeFileSync(this.cacheStore, JSON.stringify(lutPayload, null, 4));
    }

    async deserializeFromFile() {
        //populate luts from file
        const lutPayload: LookupTableJsonPayload = JSON.parse(fs.readFileSync(this.cacheStore, "utf-8"));
        for (let amm of Object.keys(lutPayload)) {
            for (let market of Object.keys(lutPayload[amm])) {
                await this.lutManager.loadLut(
                    <AutomateMarketMakers>amm,
                    market,
                    new PublicKey(lutPayload[amm][market]),
                );
            }
        }
    }
}

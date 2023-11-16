import { AddressLookupTableAccount, Connection, PublicKey } from "@solana/web3.js";
import logger from "../logger";
import { AutomateMarketMakers } from "../types";
import { AddressLookupTableBuilder } from "./addressLookupTableBuilder";
import { LutExtensionInstruction } from "./types";

type MarketLutIndex = Map<string, AddressLookupTableAccount>;

export class AddressLookupTableManager {
    lutBuilder: AddressLookupTableBuilder;
    ammLutStore: Map<string, MarketLutIndex>;
    owner: PublicKey;

    constructor(connection: Connection, payer: PublicKey, supportedAmms: AutomateMarketMakers[]) {
        this.lutBuilder = new AddressLookupTableBuilder(connection, payer);
        this.ammLutStore = new Map();
        this.owner = payer;

        supportedAmms.forEach((key) => this.ammLutStore.set(key, new Map<string, AddressLookupTableAccount>()));
    }

    getLut(amm: AutomateMarketMakers, marketSymbol: string): AddressLookupTableAccount | undefined {
        return this.ammLutStore.get(amm)!.get(marketSymbol);
    }
    /**
     *
     * @param addresses list of addresses of a single market
     * This method extends an LUT by either
     * - create a new lut and adding incomming addresses into it
     *      or
     * - use an existing lut having vaccant space and add addresses to it
     */
    async extendLut(
        amm: AutomateMarketMakers,
        marketSymbol: string,
        addresses: Array<PublicKey>,
    ): Promise<LutExtensionInstruction> {
        const lutsForAmm = this.ammLutStore.get(amm)!;
        //We can only extend an lut if there's one available and we have the authority to extend it
        if (
            lutsForAmm.size > 0 &&
            256 - lutsForAmm.get([...lutsForAmm.keys()][lutsForAmm.size - 1])!.state.addresses.length >
                addresses.length &&
            lutsForAmm.get([...lutsForAmm.keys()][lutsForAmm.size - 1])!.state.authority!.equals(this.owner)
        ) {
            if (process.env.LOGGING_LEVEL === "VERBOSE") {
                logger.info(`Extending existing Lut`);
            }
            const lastLut = lutsForAmm.get([...lutsForAmm.keys()][lutsForAmm.size - 1])!;
            const extendLutInstr = this.lutBuilder.extendLookupTableInstruction(lastLut.key, addresses);
            return {
                extendLut: extendLutInstr,
                postTxHook: async () => {
                    await this.loadLut(amm, marketSymbol, lastLut.key);
                },
            };
        } else {
            if (process.env.LOGGING_LEVEL === "VERBOSE") {
                logger.info(`Creating a new lut and extending it`);
            }
            const [lutAddr, createInstr] = await this.lutBuilder.createLookupTableInstruction();
            const extendLutInstr = this.lutBuilder.extendLookupTableInstruction(lutAddr, addresses);
            return {
                createLut: createInstr,
                extendLut: extendLutInstr,
                postTxHook: async () => {
                    await this.loadLut(amm, marketSymbol, lutAddr);
                },
            };
        }
    }
    async loadLut(amm: AutomateMarketMakers, marketSymbol: string, lutAddress: PublicKey) {
        //if multiple markets are in this lut, refresh it for them
        const marketsNeedsUpdating = [...this.ammLutStore.get(amm)!.entries()]
            .filter(([_, val]) => val.key.equals(lutAddress))
            .map(([key, _]) => key);

        const lut = await this.lutBuilder.fetchLookupTable(lutAddress);

        for (let market of marketsNeedsUpdating) {
            this.ammLutStore.get(amm)!.set(market, lut);
        }
        this.ammLutStore.get(amm)!.set(marketSymbol, lut);
    }
}

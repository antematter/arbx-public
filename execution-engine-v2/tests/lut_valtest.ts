import "mocha";
import { expect, assert } from "chai";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AddressLookupTableStore } from "../src/addressLookupTable";
import * as dotenv from "dotenv";
import { AutomateMarketMakers } from "../src/types";
import { ARBX_STORAGE_PATH_PREFIX } from "../src/constants";
import { sendAndConfirmLegacyTransaction } from "./utils";
import logger from "../src/logger";

dotenv.config();

const TEST_VALIDATOR_ENDPOINT = "http://127.0.0.1:8899";
const DUMMY_MARKETS = ["USDT-USDC", "SOL-USDC", "SRM-USDC"];
let CONNECTION: Connection;
let PAYER: Keypair;
let LUT_STORE: AddressLookupTableStore;

describe("Testing Address Lookup Table Store", () => {
    before("Establishing connection", async () => {
        //disabling logging to stdout
        logger.transports.forEach((t) => (t.silent = true));

        CONNECTION = new Connection(TEST_VALIDATOR_ENDPOINT, "confirmed");
        PAYER = Keypair.generate();
        const txSig = await CONNECTION.requestAirdrop(PAYER.publicKey, 1 * LAMPORTS_PER_SOL);
        await CONNECTION.confirmTransaction(txSig);
        const supported_amms = Object.keys(AutomateMarketMakers).map((key) => <AutomateMarketMakers>key);
        LUT_STORE = new AddressLookupTableStore(
            CONNECTION,
            PAYER.publicKey,
            supported_amms,
            ARBX_STORAGE_PATH_PREFIX + "/tests" + "/luts.json",
        );
    });

    it("Getting a lut", () => {
        const lut = LUT_STORE.getLut(AutomateMarketMakers.SRM, DUMMY_MARKETS[0]);
        assert(lut === undefined, "No lut exists initially");
    });
    it("Creating and Extending a Lut for SRM", async () => {
        /**
         * We will insert 60 addresses into SRM Lut and then
         * verify that it contains all 60 addresses.
         */
        const dummy = [...Array(20).keys()];
        const amm = <AutomateMarketMakers>"SRM";

        const addresses = [1, 2, 3].map((_) => {
            return dummy.map((_) => Keypair.generate().publicKey);
        });
        for (let i = 0; i < 3; i++) {
            const lutExtension = await LUT_STORE.extendLut(amm, DUMMY_MARKETS[i], addresses[i]);
            lutExtension.createLut &&
                (await sendAndConfirmLegacyTransaction(CONNECTION, lutExtension.createLut!.instruction, [PAYER]));

            await sendAndConfirmLegacyTransaction(CONNECTION, lutExtension.extendLut!.instruction, [PAYER]);
            await lutExtension.postTxHook!();
        }

        // All of the 60 addresses were inserted inside the same Lut.
        // Asserting each lut object has 60 addresses
        for (let market of DUMMY_MARKETS) {
            expect(LUT_STORE.lutManager.ammLutStore.get(amm)!.get(market)!.state.addresses.length).to.equal(60);
        }

        //Asserting there is only one LUT for the given amm
        const unique_luts = new Set(
            [...LUT_STORE.lutManager.ammLutStore.get(amm)!.entries()].map(([_, val]) => val.key.toString()),
        );
        expect(unique_luts.size).to.equal(1);
    });

    it("Extending for other amms except SRM", async () => {
        /**
         * Extending for other amms and veryfying each has 20 addresses.
         * Each amms should have one LUT
         */
        const dummy = [...Array(20).keys()];
        const amms = Object.keys(AutomateMarketMakers)
            .filter((key) => key !== "SRM")
            .map((key) => <AutomateMarketMakers>key);

        const addresses = [1, 2].map((_) => {
            return dummy.map((_) => Keypair.generate().publicKey);
        });

        for (let i = 0; i < 2; i++) {
            const lutExtension = await LUT_STORE.extendLut(amms[i], DUMMY_MARKETS[i], addresses[i]);
            lutExtension.createLut &&
                (await sendAndConfirmLegacyTransaction(CONNECTION, lutExtension.createLut!.instruction, [PAYER]));

            await sendAndConfirmLegacyTransaction(CONNECTION, lutExtension.extendLut!.instruction, [PAYER]);
            await lutExtension.postTxHook!();
        }

        // All of the 60 addresses were inserted inside the same Lut.
        // Asserting each lut object has 60 addresses
        for (let i = 0; i < 2; i++) {
            expect(
                LUT_STORE.lutManager.ammLutStore.get(amms[i])!.get(DUMMY_MARKETS[i])!.state.addresses.length,
            ).to.equal(20);
        }

        //Asserting there is only one LUT for the given amm
        for (let amm of amms) {
            const unique_luts = new Set(
                [...LUT_STORE.lutManager.ammLutStore.get(amm)!.entries()].map(([_, val]) => val.key.toString()),
            );
            expect(unique_luts.size).to.equal(1);
        }
    });
});

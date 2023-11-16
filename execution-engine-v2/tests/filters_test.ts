import "mocha";
import { expect } from "chai";
import * as dotenv from "dotenv";
import { TokenData } from "../src/tokens";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AutomateMarketMakers } from "../src/types";
import { Datastore } from "../src/datastore";
import { ARBX_CACHE_DIR, RPC_ENDPOINT } from "../src/constants";
import base58 from "bs58";
import { AmmFilter, MarketFilter } from "../src/filters";
import { DUMMY_ARB } from "./utils";
import logger from "../src/logger";

dotenv.config();

const tokenData = new Map<string, TokenData>();
let DATA_STORE: Datastore;
let connection: Connection;

const testMarkets = ["USDT-USDC"];
const supportedAmms = [<AutomateMarketMakers>"RAY", <AutomateMarketMakers>"SRM"];
const testTokens = ["USDT", "USDC"];
let OWNER: Keypair;

describe("Testing Arbitrage Filters", () => {
    before("Setting context", async () => {
        //disabling logging to stdout
        logger.transports.forEach((t) => (t.silent = true));

        OWNER = Keypair.fromSecretKey(base58.decode(process.env.OWNER_KEYPAIR!));
        tokenData.set("USDC", new TokenData("USDC", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), 6));
        tokenData.set("USDT", new TokenData("USDT", new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), 6));
        connection = new Connection(RPC_ENDPOINT, "confirmed");
        DATA_STORE = new Datastore(connection, OWNER, supportedAmms);
        await DATA_STORE.populate(testTokens, testMarkets, ARBX_CACHE_DIR + "/test_luts.json");
    });

    it("Testing amm filter for Arb containing supported amm", () => {
        const ammFilter = new AmmFilter(DATA_STORE);
        const testArb = structuredClone(DUMMY_ARB);
        const res = ammFilter.filter(testArb);
        expect(res).to.be.equal(true);
    });
    it("Testing amm filter for Arb containing unsupported amm", () => {
        const testArb = structuredClone(DUMMY_ARB);
        const oldAmm = testArb.amms[1];
        testArb.amms[1] = <AutomateMarketMakers>"XXXX";
        const ammFilter = new AmmFilter(DATA_STORE);
        const res = ammFilter.filter(testArb);
        testArb.amms[1] = oldAmm;
        expect(res).to.be.equal(false);
    });
    it("Testing market filter for Arb containing supported market", () => {
        const marketFilter = new MarketFilter(DATA_STORE);
        const testArb = structuredClone(DUMMY_ARB);
        const res = marketFilter.filter(testArb);
        expect(res).to.be.equal(true);
    });
    it("Testing market filter for Arb containing unsupported market", () => {
        const testArb = structuredClone(DUMMY_ARB);
        testArb.markets[1] = "ABC-DEF";
        const marketFilter = new MarketFilter(DATA_STORE);
        const res = marketFilter.filter(testArb);
        expect(res).to.be.equal(false);
    });
});

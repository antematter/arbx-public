import "mocha";
import { assert, expect } from "chai";
import * as dotenv from "dotenv";
import { TokenData } from "../src/tokens";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { ArbitrageFeed, AutomateMarketMakers, TxInstruction } from "../src/types";
import { ARBX_CACHE_DIR, RPC_ENDPOINT } from "../src/constants";
import base58 from "bs58";
import { DUMMY_ARB, SOL_TOKEN, TestDataStore, TEST_MARKETS, TEST_TOKENS, USDC_TOKEN } from "./utils";
import {
    AddressLookupTableHandler,
    AssociateTokenAccountsHandler,
    HandlerStatus,
    IArbExecutionContext,
    ILutContext,
    OpenOrdersHandler,
} from "../src/handlers";
import logger from "../src/logger";

dotenv.config();

let DATA_STORE: TestDataStore;
let connection: Connection;

const supportedAmms = [<AutomateMarketMakers>"RAY", <AutomateMarketMakers>"SRM"];
let OWNER: Keypair;

describe("Testing Handlers", () => {
    before("Setting context", async () => {
        //disabling logging to stdout
        logger.transports.forEach((t) => (t.silent = true));

        OWNER = Keypair.fromSecretKey(base58.decode(process.env.OWNER_KEYPAIR!));

        connection = new Connection(RPC_ENDPOINT, "confirmed");
        DATA_STORE = new TestDataStore(connection, OWNER, supportedAmms);
        await DATA_STORE.populate(TEST_TOKENS, TEST_MARKETS, ARBX_CACHE_DIR + "/test_luts.json");
    });

    it("Testing associated token account handler for existing ata", async () => {
        const ataHandler = new AssociateTokenAccountsHandler();
        const testArb: ArbitrageFeed = structuredClone(DUMMY_ARB);
        const result = await ataHandler.handle({
            connection: connection,
            arbitrage: testArb,
            payer: OWNER,
            dataStore: DATA_STORE,
        });
        expect(result.status).to.be.equals("OK" as HandlerStatus);
        assert(result.postTxHook === undefined, "No need to create an associated token account");
        expect((result.action as ILutContext).atas.size).to.be.equal(2);
    });

    it("Testing associated token account handler for non-existing ata", async () => {
        const ataHandler = new AssociateTokenAccountsHandler();
        const testArb: ArbitrageFeed = structuredClone(DUMMY_ARB);

        const dummyToken = new TokenData("XXXX", new PublicKey("XXX1111111111111111111111111111111111111169"), 69);
        DATA_STORE.addDummyToken("XXXX", new PublicKey("XXX1111111111111111111111111111111111111169"), 69);

        testArb.legs[0].toToken = dummyToken;
        const result = await ataHandler.handle({
            connection: connection,
            arbitrage: testArb,
            payer: OWNER,
            dataStore: DATA_STORE,
        });
        expect(result.status).to.be.equals("NOT_OK" as HandlerStatus);
        assert(result.postTxHook !== undefined, "we need to create an associated token account");
        expect((result.action as TxInstruction[]).length).to.be.equal(1);
    });

    it("Testing lookup table account handler for exisitng lut", async () => {
        const lutHandler = new AddressLookupTableHandler();
        const testArb: ArbitrageFeed = structuredClone(DUMMY_ARB);
        const result = await lutHandler.handle({
            connection: connection,
            arbitrage: testArb,
            payer: OWNER,
            dataStore: DATA_STORE,
            atas: new Map(),
        });
        expect(result.status).to.be.equals("OK" as HandlerStatus);
        assert(result.postTxHook === undefined, "No need to create or extend an lut");
        expect((result.action as IArbExecutionContext).luts.length).to.be.equal(2);
    });

    it("Testing lookup table account handler for non-exisitng lut", async () => {
        const lutHandler = new AddressLookupTableHandler();
        const testArb: ArbitrageFeed = structuredClone(DUMMY_ARB);

        DATA_STORE.addDummySRMMarket("USDC-XXXX");
        testArb.markets[0] = "USDC-XXXX";

        const result = await lutHandler.handle({
            connection: connection,
            arbitrage: testArb,
            payer: OWNER,
            dataStore: DATA_STORE,
            atas: new Map(),
        });
        expect(result.status).to.be.equals("NOT_OK" as HandlerStatus);
        assert(result.postTxHook !== undefined, "We need to create or extend an lut");
        expect((result.action as TxInstruction[]).length).to.be.gte(1);
    });

    it("Testing open orders acount hander for exiting account(1)", async () => {
        const ooHandler = new OpenOrdersHandler();
        const testArb: ArbitrageFeed = structuredClone(DUMMY_ARB);

        const result = await ooHandler.handle({
            connection: connection,
            arbitrage: testArb,
            payer: OWNER,
            dataStore: DATA_STORE,
            atas: new Map(),
            luts: [],
        });

        expect(result.status).to.be.equals("OK" as HandlerStatus);
        assert(result.postTxHook === undefined, "No need to create an open order account");
        expect((result.action as IArbExecutionContext).ooAccounts!.size).to.be.equal(1); //Only one OO because only 1 SRM market
    });

    it("Testing open orders acount hander for exiting account(2)", async () => {
        const ooHandler = new OpenOrdersHandler();
        const testArb: ArbitrageFeed = structuredClone(DUMMY_ARB);

        testArb.amms.push(<AutomateMarketMakers>"SRM");
        testArb.legs.push({
            toToken: SOL_TOKEN,
            fromToken: USDC_TOKEN,
        });
        testArb.markets.push("sol-usdc");
        testArb.prices.push(0);
        testArb.volumes.push(0);

        const result = await ooHandler.handle({
            connection: connection,
            arbitrage: testArb,
            payer: OWNER,
            dataStore: DATA_STORE,
            atas: new Map(),
            luts: [],
        });

        expect(result.status).to.be.equals("OK" as HandlerStatus);
        assert(result.postTxHook === undefined, "No need to create an open order account");
        expect((result.action as IArbExecutionContext).ooAccounts!.size).to.be.equal(2);
    });

    it("Testing open orders acount hander for non exiting account", async () => {
        const ooHandler = new OpenOrdersHandler();
        const testArb: ArbitrageFeed = structuredClone(DUMMY_ARB);

        DATA_STORE.addDummySRMMarket("USDC-XXXX", true);
        testArb.markets[0] = "USDC-XXXX";

        const result = await ooHandler.handle({
            connection: connection,
            arbitrage: testArb,
            payer: OWNER,
            dataStore: DATA_STORE,
            atas: new Map(),
            luts: [],
        });

        expect(result.status).to.be.equals("NOT_OK" as HandlerStatus);
        assert(result.postTxHook !== undefined, "We need to create an open order account");
        expect((result.action as TxInstruction[]).length).to.be.equal(1);
    });
});

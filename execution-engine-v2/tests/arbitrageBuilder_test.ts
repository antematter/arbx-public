import "mocha";
import { assert, expect } from "chai";
import * as dotenv from "dotenv";
import { Connection, Keypair } from "@solana/web3.js";
import { ArbitrageFeed, AutomateMarketMakers } from "../src/types";
import { ARBX_CACHE_DIR, RPC_ENDPOINT } from "../src/constants";
import base58 from "bs58";
import { SOL_TOKEN, TestDataStore, TEST_MARKETS, TEST_TOKENS, USDC_TOKEN } from "./utils";
import {
    AddressLookupTableHandler,
    AssociateTokenAccountsHandler,
    IArbExecutionContext,
    ILutContext,
    OpenOrdersHandler,
} from "../src/handlers";
import logger from "../src/logger";
import { ArbitrageCommand } from "../src/arbitrageCommandBuilder/types";
import { ArbitrageCommandBuilder } from "../src/arbitrageCommandBuilder";

dotenv.config();

let DATA_STORE: TestDataStore;
let connection: Connection;

const SUPPORTED_AMMS = [<AutomateMarketMakers>"RAY", <AutomateMarketMakers>"SRM"];
let OWNER: Keypair;
let ARB_EXECUTION_CTX: IArbExecutionContext;
let ARBITRAGE_COMMAND: ArbitrageCommand;

const TEST_ARB: ArbitrageFeed = {
    prices: [0.0316816626536561, 31.5852601847056],
    volumes: [300.0, 9814935.357628],
    amms: [<AutomateMarketMakers>"SRM", <AutomateMarketMakers>"RAY"],
    markets: ["sol-usdc", "sol-usdc"],
    slippage: 1,
    startAmount: 5,
    profitPotential: 1.23,
    legs: [
        {
            fromToken: USDC_TOKEN,
            toToken: SOL_TOKEN,
        },
        {
            fromToken: SOL_TOKEN,
            toToken: USDC_TOKEN,
        },
    ],
};

describe("Testing Arbitrage Builder", () => {
    before("Setting context", async () => {
        //disabling logging to stdout
        logger.transports.forEach((t) => (t.silent = true));

        OWNER = Keypair.fromSecretKey(base58.decode(process.env.OWNER_KEYPAIR!));
        connection = new Connection(RPC_ENDPOINT, "confirmed");
        DATA_STORE = new TestDataStore(connection, OWNER, SUPPORTED_AMMS);
        await DATA_STORE.populate(TEST_TOKENS, TEST_MARKETS, ARBX_CACHE_DIR + "/test_luts.json");

        const ataHandler = new AssociateTokenAccountsHandler();
        const lutHandler = new AddressLookupTableHandler();
        const ooHandler = new OpenOrdersHandler();
        const arbCommandBuilder = new ArbitrageCommandBuilder();

        const ataResult = await ataHandler.handle({
            connection: connection,
            arbitrage: TEST_ARB,
            payer: OWNER,
            dataStore: DATA_STORE,
        });

        const lutResult = await lutHandler.handle(ataResult.action as ILutContext);
        const result = await ooHandler.handle(lutResult.action as IArbExecutionContext);

        ARB_EXECUTION_CTX = result.action as IArbExecutionContext;
        ARBITRAGE_COMMAND = await arbCommandBuilder.buildArbitrage(ARB_EXECUTION_CTX);
    });

    it("Testing number of swap legs ", () => {
        expect(ARBITRAGE_COMMAND.swapLegs.length).to.be.equal(2);
    });
    it("Testing input amounts", () => {
        expect(ARBITRAGE_COMMAND.swapLegs[0].inputAmount).to.be.equal(TEST_ARB.startAmount);
        expect(ARBITRAGE_COMMAND.swapLegs[0].outputAmount).to.be.equal(ARBITRAGE_COMMAND.swapLegs[1].inputAmount);
    });
    it("Testing Sol wrapping and unwrapping", () => {
        assert(ARBITRAGE_COMMAND.wrapSol !== undefined, "As the arb has sol, it needs to be wrapped");
        assert(ARBITRAGE_COMMAND.unwrapSol !== undefined, "As the arb has sol, it needs to be wrapped");
        expect(ARBITRAGE_COMMAND.wrapSol!.length).to.be.equal(2);
    });
});

//Possibly add the following
// testing output amounts
// testing min exchange rate
// testing base and quote liquidities

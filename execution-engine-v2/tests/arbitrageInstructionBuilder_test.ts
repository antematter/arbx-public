import "mocha";
import { expect } from "chai";
import * as dotenv from "dotenv";
import { TokenData } from "../src/tokens";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
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
import { ArbitrageInstructionBuilder } from "../src/arbitrageInstructionBuilder";

dotenv.config();

const tokenData = new Map<string, TokenData>();
let DATA_STORE: TestDataStore;
let connection: Connection;

const supportedAmms = [<AutomateMarketMakers>"RAY", <AutomateMarketMakers>"SRM"];
let OWNER: Keypair;
let ARB_EXECUTION_CTX: IArbExecutionContext;
let ARB_EXECUTION_CTX_2: IArbExecutionContext;
let ARBITRAGE_COMMAND: ArbitrageCommand;
let ARBITRAGE_COMMAND_2: ArbitrageCommand;
let ARBITRAGE_IX: ArbitrageInstructionBuilder;

const TEST_ARB_1: ArbitrageFeed = {
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

const TEST_ARB_2: ArbitrageFeed = {
    prices: [0.0316816626536561, 31.5852601847056],
    volumes: [300.0, 9814935.357628],
    amms: [<AutomateMarketMakers>"SRM", <AutomateMarketMakers>"RAY"],
    markets: ["usdt-usdc", "usdt-usdc"],
    slippage: 1,
    startAmount: 5,
    profitPotential: 1.23,
    legs: [
        {
            fromToken: new TokenData("usdc", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), 6),
            toToken: new TokenData("usdt", new PublicKey("So11111111111111111111111111111111111111112"), 9),
        },
        {
            fromToken: new TokenData("usdt", new PublicKey("So11111111111111111111111111111111111111112"), 9),
            toToken: new TokenData("usdc", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), 6),
        },
    ],
};

describe("Testing Arbitrage Instruction Builder", () => {
    before("Setting context", async () => {
        //disabling logging to stdout
        // logger.transports.forEach((t) => (t.silent = true));

        OWNER = Keypair.fromSecretKey(base58.decode(process.env.OWNER_KEYPAIR!));
        tokenData.set("USDC", new TokenData("USDC", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), 6));
        tokenData.set("USDT", new TokenData("USDT", new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), 6));
        tokenData.set("SOL", new TokenData("SOL", new PublicKey("So11111111111111111111111111111111111111112"), 9));

        connection = new Connection(RPC_ENDPOINT, "confirmed");
        DATA_STORE = new TestDataStore(connection, OWNER, supportedAmms);
        await DATA_STORE.populate(TEST_TOKENS, TEST_MARKETS, ARBX_CACHE_DIR + "/test_luts.json");

        const ataHandler = new AssociateTokenAccountsHandler();
        const lutHandler = new AddressLookupTableHandler();
        const ooHandler = new OpenOrdersHandler();
        const arbCommandBuilder = new ArbitrageCommandBuilder();

        //TEST_ARB_1
        const ataResult = await ataHandler.handle({
            connection: connection,
            arbitrage: TEST_ARB_1,
            payer: OWNER,
            dataStore: DATA_STORE,
        });

        const lutResult = await lutHandler.handle(ataResult.action as ILutContext);
        const result = await ooHandler.handle(lutResult.action as IArbExecutionContext);

        ARB_EXECUTION_CTX = result.action as IArbExecutionContext;
        ARBITRAGE_COMMAND = await arbCommandBuilder.buildArbitrage(ARB_EXECUTION_CTX);

        //TEST_ARB_2
        const ataResult_2 = await ataHandler.handle({
            connection: connection,
            arbitrage: TEST_ARB_2,
            payer: OWNER,
            dataStore: DATA_STORE,
        });

        const lutResult_2 = await lutHandler.handle(ataResult_2.action as ILutContext);
        const result_2 = await ooHandler.handle(lutResult_2.action as IArbExecutionContext);

        ARB_EXECUTION_CTX_2 = result_2.action as IArbExecutionContext;
        ARBITRAGE_COMMAND_2 = await arbCommandBuilder.buildArbitrage(ARB_EXECUTION_CTX_2);

        ARBITRAGE_IX = new ArbitrageInstructionBuilder(connection, OWNER);
        await ARBITRAGE_IX.load();
    });

    it("Testing number of instructions for sol arb", async () => {
        //As we have a sol arb, the number of instructions are equal to
        // - Swaplegs
        // - Wrap Sol(create Sol Account + Init) = 2
        // - Close Sol Account = 1

        //Here we expect 5 instructions
        // wrapSol
        // create sol account
        // initialize it
        // First SwapLeg
        // Second SwapLeg
        // unwrap Sol
        const { instructions, signers: _ } = await ARBITRAGE_IX.buildArbitrageInstruction(ARBITRAGE_COMMAND);
        expect(instructions.length).to.be.equal(5);
    });
    it("Testing number of instructions for none-sol arb", async () => {
        //For a non-sol, the number of instructions are equal to number of swap legs.
        //Here, we expect 2 instructions
        // First SwapLeg
        // Second SwapLeg
        const { instructions, signers: _ } = await ARBITRAGE_IX.buildArbitrageInstruction(ARBITRAGE_COMMAND_2);
        expect(instructions.length).to.be.equal(2);
    });

    it("Testing number of signers for sol arb", async () => {
        // a sol arb will have one signer: Wrapped Sol Account
        const { instructions: _, signers } = await ARBITRAGE_IX.buildArbitrageInstruction(ARBITRAGE_COMMAND);
        expect(signers.length).to.be.equal(1);
    });
    it("Testing number of signers for non-sol arb", async () => {
        // a non-sol arb will have no signers at all
        const { instructions: _, signers } = await ARBITRAGE_IX.buildArbitrageInstruction(ARBITRAGE_COMMAND_2);
        expect(signers.length).to.be.equal(0);
    });
});

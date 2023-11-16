import "mocha";
import { expect } from "chai";
import { TokenData, TokenDataLoader } from "../src/tokens";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { RaydiumDataLoader, SerumDataLoader } from "../src/amms";
import { RPC_ENDPOINT } from "../src/constants";
import logger from "../src/logger";
import { AssosiatedTokenAccountLoader } from "../src/tokens/ataLoader";
import { SOL_TOKEN, SRM_TOKEN, TEST_MARKETS, TEST_TOKENS, USDC_TOKEN, USDT_TOKEN } from "./utils";

dotenv.config();

const MARKET_SYMBOLS = TEST_MARKETS.map((market) => market.toLowerCase());
const tokenData = new Map<string, TokenData>();

let connection: Connection;

describe("Testing Amms DataLoaders", () => {
    before(() => {
        //disabling logging to stdout
        logger.transports.forEach((t) => (t.silent = true));

        //populating some tokens
        tokenData.set("usdc", USDC_TOKEN);
        tokenData.set("usdt", USDT_TOKEN);
        tokenData.set("sol", SOL_TOKEN);
        tokenData.set("srm", SRM_TOKEN);

        connection = new Connection(RPC_ENDPOINT, "confirmed");
    });

    it("Serum DataLoader", async () => {
        const sdl = new SerumDataLoader({
            connection,
            tokenData,
            owner: new PublicKey(process.env.OWNER_PUBKEY!),
        });

        const markets = await sdl.load(MARKET_SYMBOLS);

        //testing markets fetched
        expect(markets.rawSerumMarkets.size).to.equal(2); // only the data of 2 markets be fetched
        expect([...markets.rawSerumMarkets.keys()]).to.have.all.members(MARKET_SYMBOLS); // tests markets should be included in fetched markets info

        //as the open order accounts for bdrc already exist, we ensure them
        expect(markets.openOrderAccounts.size).to.equal(2); //only 2 open orders accounts are needed for 2 markets
        expect([...markets.openOrderAccounts.keys()]).to.have.all.members(MARKET_SYMBOLS); //tests markets have corresponding oo accounts
    });

    it("Raydium DataLoader", async () => {
        const rdl = new RaydiumDataLoader({
            connection,
            tokenData,
            owner: new PublicKey(process.env.OWNER_PUBKEY!),
        });

        const markets = await rdl.load(MARKET_SYMBOLS);

        //testing markets fetched
        expect(markets.poolsKeys.size).to.equal(2); // only the data of 2 markets be fetched
        expect([...markets.poolsKeys.keys()]).to.have.all.members(MARKET_SYMBOLS); // test markets should be included in fetched markets info
    });
});

describe("Testing Token DataLoader", () => {
    it("Tokens DataLoader", async () => {
        const tdl = new TokenDataLoader();
        const tokens = await tdl.load(new Set(TEST_TOKENS));

        //testing tokens fetched
        expect(tokens.size).to.equal(4); // only 4 tokens are fetched
        expect([...tokens.keys()]).to.have.all.members(TEST_TOKENS); // all test tokens are present
    });
});

describe("Testing Associated Token Accounts DataLoader", () => {
    it("Associated Token Accounts DataLoader", async () => {
        const conn = new Connection(RPC_ENDPOINT, "confirmed");
        const supportedTokens = new Map<string, TokenData>();
        supportedTokens.set("usdc", USDC_TOKEN);
        supportedTokens.set("usdt", USDT_TOKEN);
        supportedTokens.set("sol", SOL_TOKEN);
        supportedTokens.set("srm", SRM_TOKEN);

        const atal = new AssosiatedTokenAccountLoader(conn, new PublicKey(process.env.OWNER_PUBKEY!));
        const atas = await atal.load(tokenData);

        //A dummy Sol ATA is hardcoded in AssosiatedTokenAccountLoader but SOL tx needs wrapping and unwrapping

        expect(atas.size).to.equal(4);
        expect([...atas.keys()]).to.have.all.members(["usdc", "usdt", "srm", "sol"]);
    });
});

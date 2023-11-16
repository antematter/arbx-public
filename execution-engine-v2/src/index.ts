import fs from "fs";
import { Connection, Keypair } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { RPC_ENDPOINT } from "./constants";
import logger, { arbLogger } from "./logger";
import ReconnectingWebSocket from "reconnecting-websocket";
import WebSocket from "ws";
import { ArbitrageFeed, ArbitrageFeedResult, ArbXConfig, AutomateMarketMakers, RawArbitrage } from "./types";
import { Datastore } from "./datastore";
import base58 from "bs58";
import { SUPPORTED_MARKETS, SUPPORTED_TOKENS } from "../supported-markets";
import { ArbitrageDispatcher } from "./arbitrageDispatcher";
import { AmmFilter, MarketFilter } from "./filters";
import { ProfitPotentialFilter } from "./filters/profitPotentialFilter";
import { createArbitrageFeed } from "./utils";

dotenv.config();

const MIN_PROFIT_POTENTIAL: number = 1.005;
const FEED_SERVER_WS = "ws://72.52.83.236:9000";

async function main() {
    if (process.argv.length < 3) {
        logger.error("Please pass the config file path as argument");
        process.exit(1);
    }

    const configPath = process.argv[2];
    if (!fs.existsSync(configPath)) {
        logger.error("Config file does not exist");
        process.exit(1);
    }
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as ArbXConfig;

    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const payer = Keypair.fromSecretKey(base58.decode(config.privateKey));
    const supportedAmms = [<AutomateMarketMakers>"RAY", <AutomateMarketMakers>"SRM", <AutomateMarketMakers>"ORCA"];

    const arbitrageQueue: Array<ArbitrageFeed> = [];

    const datastore = new Datastore(connection, payer, supportedAmms);
    logger.info(`populating datastore`);
    await datastore.populate(SUPPORTED_TOKENS, SUPPORTED_MARKETS);
    if (process.env.LOGGING_LEVEL === "VERBOSE") {
        logger.info(`Loaded data: ${JSON.stringify(datastore.getLoadedData(), null, 4)}`);
    }
    logger.info(`populating datastore completed`);

    const dispatcher = new ArbitrageDispatcher(connection, payer, datastore);
    logger.info(`initialzing arbitrage dispatcher`);
    await dispatcher.initialize();
    dispatcher.registerFilter({
        filter: new AmmFilter(datastore),
        name: "Amm Filter",
    });
    dispatcher.registerFilter({
        filter: new MarketFilter(datastore),
        name: "Market Filter",
    });
    dispatcher.registerFilter({
        filter: new ProfitPotentialFilter(MIN_PROFIT_POTENTIAL),
        name: "Profit Potential Filter",
    });
    logger.info(`initialzing arbitrage dispatcher completed`);

    logger.info(`connecting with feed server`);
    const ws = new ReconnectingWebSocket(FEED_SERVER_WS, [], {
        WebSocket: WebSocket,
    });
    ws.onopen = () => {
        ws.send(payer.publicKey.toString());
    };
    logger.info(`connecting with feed server completed`);

    ws.onmessage = (msg) => {
        const arb: RawArbitrage = JSON.parse(msg.data);
        const [status, arbFeed] = createArbitrageFeed(arb, datastore, config.inputAmount, config.slippage);
        if (status === ArbitrageFeedResult.InvalidToken) {
            arbLogger.error(`Token not supported: ${JSON.stringify(arb, null, 2)}`);
            logger.error(`Token not supported: ${JSON.stringify(arb.tokens)}`);
        } else if (status === ArbitrageFeedResult.InvalidMarket) {
            arbLogger.error(`Market not supported: ${JSON.stringify(arb, null, 2)}`);
            logger.error(
                `Market not supported: ${JSON.stringify({
                    tokens: arb.tokens,
                    trades: arb.trades,
                })}`,
            );
        } else {
            // await dispatcher.submitArbitrage(arbFeed!);
            arbitrageQueue.push(arbFeed!);
        }
    };

    ws.onclose = () => {
        logger.error("Disconnected from the feed server");
    };

    ws.onerror = (err) => {
        logger.error(`Error with the feed server: ${err}`);
    };

    const arbitrageRunner = async () => {
        if (arbitrageQueue.length > 0) {
            let arb = arbitrageQueue.pop();
            while (arb && arb.legs[0].fromToken.symbol === config.targetToken.toLowerCase()) arb = arbitrageQueue.pop();

            if (!arb || arb.legs[0].fromToken.symbol !== config.targetToken.toLowerCase()) {
                setTimeout(arbitrageRunner, 1000);
                return;
            }

            try {
                await dispatcher.submitArbitrage(arb!);
            } catch (error) {
                logger.error(error);
                console.trace();
            }
        }
        setTimeout(arbitrageRunner, 1000);
    };

    arbitrageRunner();
}

main();

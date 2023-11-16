import ReconnectingWebSocket from "reconnecting-websocket";
import WebSocket from "ws";
import logger from "../logger";
import { Arbitrage, DexMarket } from "../types";

const FEED_SERVER_WS = "ws://72.52.83.236:9000";

const arbitrages: Arbitrage[] = [];

export const subscribe = async (
  pubkey: string,
  tokens: string[],
  processArb: (arbitrage: Arbitrage) => Promise<void>,
) => {
  const ws = new ReconnectingWebSocket(FEED_SERVER_WS, [], {
    WebSocket: WebSocket,
  });

  ws.onopen = () => {
    logger.info("Connected to the feed server");
    logger.info("Filtering on tokens:", tokens);
    ws.send(pubkey);
  };

  ws.onmessage = (msg) => {
    logger.info("Received message from feed server:", msg.data);
    arbitrages.push(...JSON.parse(msg.data));
  };

  ws.onclose = () => {
    logger.info("Disconnected from the feed server");
  };

  ws.onerror = (err) => {
    logger.warn("Error with the feed server:", err);
  };

  const executeAvailableArb = async () => {
    if (arbitrages.length > 0) {
      let arb = arbitrages.pop();

      if (process.env.NODE_ENV === "production") {
        while (arb && !tokens.includes(arb!.tokens[0])) arb = arbitrages.pop();

        if (!arb || !tokens.includes(arb!.tokens[0])) {
          setTimeout(executeAvailableArb, 1000);
          return;
        }
      }

      if (arb!.markets.includes(DexMarket.ORCA)) {
        setTimeout(executeAvailableArb, 1000);
        return;
      }

      try {
        console.log(`Executing Arb: ${JSON.stringify(arb)}`);
        await processArb(arb!);
      } catch (error) {
        logger.error("Error processing arbitrage:", error);
      }
    }

    setTimeout(executeAvailableArb, 1000);
  };

  executeAvailableArb();
};

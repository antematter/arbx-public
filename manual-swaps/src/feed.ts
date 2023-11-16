import WebSocket from "ws";
import { logger } from "../utils/logger";
import { RawArbitrage } from "../utils/types";
import { executeRawArbitrage } from "./raw-arbs";
import { FEED_SERVER_WS, OWNER } from "../utils/constants";
import ReconnectingWebSocket from "reconnecting-websocket";


const arbitrages: RawArbitrage[] = [];

export const executeArbsFromFeed = async () => {
  const ws = new ReconnectingWebSocket(FEED_SERVER_WS, [], {
    WebSocket: WebSocket,
  });

  ws.onopen = () => {
    logger.info("Connected to the feed server");
    ws.send(OWNER.publicKey.toBase58());
  };

  ws.onmessage = (msg) => {
    const newArb = JSON.parse(msg.data) as RawArbitrage;
    arbitrages.push(newArb);
  };

  ws.onclose = () => {
    logger.info("Disconnected from the feed server");
  };

  ws.onerror = (err) => {
    logger.info("Error with the feed server:", err.message);
  };

  const executeAnyAvailableArb = async (): Promise<void> => {
    let arb = arbitrages.pop();
    if (arb) {
      await executeRawArbitrage(arb!);
    }
    setTimeout(executeAnyAvailableArb, 1000);
  };
  await executeAnyAvailableArb();
};

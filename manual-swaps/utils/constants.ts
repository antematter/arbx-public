import chalk from 'chalk';
import { Connection, Keypair } from "@solana/web3.js";

export const OWNER = Keypair.fromSecretKey(
  Uint8Array.from([
    96, 31, 141, 43, 244, 27, 1, 1, 147, 103, 183, 32, 130, 146, 1, 125, 213,
    249, 74, 222, 237, 230, 88, 197, 227, 32, 184, 130, 203, 13, 112, 112,
    157, 233, 153, 58, 6, 5, 69, 254, 45, 129, 222, 132, 32, 17, 131, 191,
    200, 170, 102, 70, 234, 67, 200, 127, 243, 40, 48, 69, 132, 20, 140, 129,
  ])
);

export const CONNECTION = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed"
);

export const SLIPPAGE = 5; // 5%
export const INITIAL_SWAP_DOLLAR_AMOUNT = 5;
export const FEED_SERVER_WS = "ws://72.52.83.236:9000";
export const RETRY_LIMIT = 3;
export const ORCA_PREFIX = chalk.yellow.bold("[ORCA]");
export const RAY_PREFIX = chalk.cyan.bold("[RAY]");

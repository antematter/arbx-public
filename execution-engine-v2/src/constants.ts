import os from "os";
import { PublicKey } from "@solana/web3.js";

export const MARKETS_URL: string = "https://cache.jup.ag/markets?v=3";
export const RAYDIUM_AMM_V4_PROGRAM_ID: string = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

export const AUTH_RPC_ENDPOINT: string = "http://185.209.177.4:8899";

export const RPC_ENDPOINT: string = "http://185.209.177.4:8899";

export const MAINNET_SERUM_DEX_PROGRAM = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
export const MAX_TRANSACTION_RETRY_ATTEMPTS: number = 3;
export const WRAPPED_SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const ENABLE_TRADING = true;
export const PERCENT_INPUT_SERUM = 95;

export const SERUM_FEE = 0.0022; //0.22 % = 0.22/100 = 0.0022
export const RAYDIUM_FEE = 0.0025; //0.25% = 0.25/100 = 0.0025

export const SAVE_TX_ENDPOINT = "https://bmvrn7x3g7.execute-api.us-east-1.amazonaws.com/tx-logs";
export const MAX_ADDRESSES_IN_LUT = 256;

export const ARBX_STORAGE_PATH_PREFIX =
    process.env.NODE_ENV === "production"
        ? (process.platform === "win32" ? process.env.APPDATA! : os.homedir() + "/.cache") + "/arbx"
        : ".";

export const TRANSACTION_LOGS_DIR = ARBX_STORAGE_PATH_PREFIX + "/logs";
export const ARBX_CACHE_DIR = ARBX_STORAGE_PATH_PREFIX + "/cache";
export const LUTS_FILE_CACHE = ARBX_CACHE_DIR + "/luts.json";

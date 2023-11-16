import * as dotenv from "dotenv";
dotenv.config();

import { Connection, Keypair } from "@solana/web3.js";
import base58 from "bs58";
import fs from "fs";
import { Arbitrage, ArbXConfig } from "./types";
import { DataStore } from "./dataStore";
import { ArbitrageExecutor } from "./arb-executor";
import { subscribe } from "./feed";
import { AUTH_RPC_ENDPOINT, RPC_ENDPOINT } from "./constants";
import { Metaplex } from "@metaplex-foundation/js";
import logger from "./logger";

const WORTHLESS_PIXELS_NFTS_SYMBOL = "WPIX";

export class Runner {
  private connection: Connection;
  private config: ArbXConfig;

  private dataStore?: DataStore;
  private arbEngine?: ArbitrageExecutor;

  private ready: boolean = false;

  constructor(config: ArbXConfig) {
    this.config = config;
    this.connection = new Connection(RPC_ENDPOINT, "confirmed");

    this.validateConfig();
    this.config.keypair = Keypair.fromSecretKey(base58.decode(config.privateKey));
  }

  private validateConfig() {
    if (!this.config.targetToken) throw new Error("Target token is not set");

    if (!this.config.slippage) throw new Error("Slippage is not set");
    if (typeof this.config.slippage !== "number") throw new Error("Slippage is not a number");
    if (this.config.slippage < 0 || this.config.slippage > 30) throw new Error("Slippage is not in range [0, 30]");

    if (!this.config.inputAmount) throw new Error("Input amount is not set");
    if (typeof this.config.inputAmount !== "number") throw new Error("Input amount is not a number");
    if (this.config.inputAmount < 0) throw new Error("Input amount is not positive");

    if (!this.config.privateKey) throw new Error("Private key is not set");
  }

  private async authenticate() {
    const metaplex = new Metaplex(new Connection(AUTH_RPC_ENDPOINT, "confirmed"));
    const nfts = await metaplex.nfts().findAllByOwner({ owner: this.config.keypair!.publicKey });
    const wpNfts = nfts.filter((nft) => nft.symbol === WORTHLESS_PIXELS_NFTS_SYMBOL);
    if (wpNfts.length === 0) throw new Error("No worthless pixels NFTs found");
  }

  async initialize() {
    if (process.env.NODE_ENV === "production") await this.authenticate();
    this.dataStore = await DataStore.populate(this.connection, this.config.keypair!);

    const targetTokenMint = this.dataStore.tokenMints.get(this.config.targetToken);
    if (!targetTokenMint) throw new Error("Target token mint not found");

    const parsedTokenAccountInfo = await this.connection.getParsedTokenAccountsByOwner(this.config.keypair!.publicKey, {
      mint: targetTokenMint,
    });
    const tokenBalance = parsedTokenAccountInfo.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    if (tokenBalance < this.config.inputAmount) throw new Error("Not enough tokens to execute arbitrage");

    this.arbEngine = new ArbitrageExecutor(this.connection, this.config.keypair!, this.dataStore!);
    await this.arbEngine!.loadOrCreateLUTs();

    this.ready = true;
  }

  async execute(arb: Arbitrage) {
    if (!this.ready) throw new Error("Runner is not ready");
    await this.arbEngine?.executeArbitrage(arb, this.config.inputAmount, this.config.slippage);
  }
}

const main = async () => {
  if (process.argv.length < 3) {
    logger.error("Please pass the config file path as argument");
  }

  const configPath = process.argv[2];
  if (!fs.existsSync(configPath)) {
    logger.error("Config file does not exist");
    return;
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as ArbXConfig;

  const runner = new Runner(config);
  await runner.initialize();

  const pubkey = Keypair.fromSecretKey(base58.decode(config.privateKey)).publicKey.toBase58();

  subscribe(pubkey, [config.targetToken], async (arbitrage: any) => {
    await runner.execute(arbitrage);
  });
};

main().catch((err) => {
  logger.error(err);
  setTimeout(() => process.exit(1), 5000);
});

import {
  Connection,
  Keypair,
  PublicKey,
  Signer,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { DataStore } from "../dataStore";
import { SwapInstructionBuilder } from "../swapInstructionBuilder";
import { AddressLookupTableProgram } from "@solana/web3.js";
import { TransactionExecutor } from "../transaction-executor";
import fs from "fs";
import { findAssociatedTokenAddress } from "./utils";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { MAINNET_SERUM_DEX_PROGRAM, PERCENT_INPUT_SERUM, TRANSACTION_LOGS_DIR } from "../constants";
import { Arbitrage, DexMarket, Leg, Side } from "../types";
import { SUPPORTED_RAYDIUM_MARKETS_ADDRESSES, SUPPORTED_SERUM_MARKETS } from "../markets/supported-markets";
import assert from "assert";
import { fetchPoolKeys, getAssociatedTokenAddress, getMarketSymbol, getVaultOwnerAndNonce } from "../utils";
import logger from "../logger";

interface MarketLookupTableCache {
  [symbol: string]: string; //Name of the serum market against its LUT
}
interface AddressLookupTableCache {
  [symbol: string]: MarketLookupTableCache; // Name of the dex/amms against addresses of its luts
}

export class ArbitrageExecutor {
  private connection: Connection;
  private payer: Keypair;
  private dataStore: DataStore;
  private swapBuilder: SwapInstructionBuilder;
  private transactionExecutor: TransactionExecutor;
  private serumMarketsLookupTableAddresses: Map<string, PublicKey>;
  private raydiumMarketsLookupTableAddresses: Map<string, PublicKey>;

  constructor(connection: Connection, payer: Keypair, dataStore: DataStore) {
    this.connection = connection;
    this.payer = payer;
    this.dataStore = dataStore;
    this.swapBuilder = new SwapInstructionBuilder({
      connection: this.connection,
      payer: this.payer,
      datastore: this.dataStore,
    });

    this.transactionExecutor = new TransactionExecutor(this.connection, this.payer.publicKey.toString());

    this.serumMarketsLookupTableAddresses = new Map();
    this.raydiumMarketsLookupTableAddresses = new Map();
  }

  private createArbLegs(
    arb: Array<string>,
    sides: Array<Side>,
    markets: Array<DexMarket>,
  ): [Array<Leg>, Array<[string, DexMarket]>] {
    const arbLegs: Array<Leg> = [];
    const marketSymbols: Array<[string, DexMarket]> = [];
    let baseMint: PublicKey;
    let quoteMint: PublicKey;

    for (let index = 0; index < arb.length - 1; index++) {
      const possibleMarketA = getMarketSymbol(arb[index], arb[index + 1]);
      const possibleMarketB = getMarketSymbol(arb[index + 1], arb[index]);

      if (this.dataStore.serumMarketKeys.has(possibleMarketA)) {
        baseMint = this.dataStore.tokenMints.get(arb[index])!;
        quoteMint = this.dataStore.tokenMints.get(arb[index + 1])!;
      } else {
        assert(this.dataStore.serumMarketKeys.has(possibleMarketB), "Specifed market does not exist");
        baseMint = this.dataStore.tokenMints.get(arb[index + 1])!;
        quoteMint = this.dataStore.tokenMints.get(arb[index])!;
      }

      const baseMintDecimals: number = this.dataStore.tokenDecimals.get(
        this.dataStore.mintTokens.get(baseMint.toString())!,
      )!;
      const quoteMintDecimals: number = this.dataStore.tokenDecimals.get(
        this.dataStore.mintTokens.get(quoteMint.toString())!,
      )!;
      const leg: Leg = {
        baseMint,
        quoteMint,
        baseMintDecimals,
        quoteMintDecimals,
        side: sides[index],
        market: markets[index],
      };
      arbLegs.push(leg);
      marketSymbols.push([
        getMarketSymbol(
          this.dataStore.mintTokens.get(baseMint.toString())!,
          this.dataStore.mintTokens.get(quoteMint.toString())!,
        ),
        markets[index],
      ]);
    }
    return [arbLegs, marketSymbols];
  }

  async createArbitrageTransaction(instructions: TransactionInstruction[], marketSymbols: Array<[string, DexMarket]>) {
    const blockhash = (await this.connection.getLatestBlockhash("confirmed")).blockhash;
    const lookupTableAccounts = marketSymbols.map((symbol) => {
      if (symbol[1] === DexMarket.SRM) {
        return this.dataStore.serumMarketsLookupTableAccounts!.get(symbol[0])!;
      } else {
        // if(symbol[1] === DexMarket.Raydium){
        return this.dataStore.raydiumMarketsLookupTableAccounts!.get(symbol[0])!;
      }
    });
    const message = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: blockhash,
      instructions: instructions,
    }).compileToV0Message(lookupTableAccounts);

    const tx = new VersionedTransaction(message);
    return tx;
  }

  async executeArbitrage(arbitrage: Arbitrage, startVolume: number, slippage: number) {
    const trades: Side[] = [];
    arbitrage.trades.forEach((trade: any) => {
      if (trade === "ASK") {
        trades.push(Side.Bid);
      } else {
        trades.push(Side.Ask);
      }
    });
    const [arbLegs, marketSymbols] = this.createArbLegs(arbitrage.tokens, trades, arbitrage.markets);

    const txSigners: Set<Signer> = new Set([this.payer]);
    const swapInstructions: TransactionInstruction[] = [];
    let wrapSolMintAddress: PublicKey | undefined;

    let wrapSolTxInstr, unWrapSolTxInstr;
    let inputVolume = startVolume;
    let isFirstLeg = true;

    for (let index = 0; index < arbLegs.length; index++) {
      if (arbLegs[index].market === DexMarket.SRM) {
        const { serumSwapTxs, openOrderTx, wrapWSOLTx, unwrapWSOLTx, outAmount, signers, wrapSolMint } =
          await this.swapBuilder.buildSerumSwapInstruction(
            {
              inputAmount: inputVolume,
              slippage: slippage,
              leg: arbLegs[index],
              routeFare: arbitrage.prices[index],
              lutAddress: this.dataStore.serumMarketsLookupTableAccounts!.get(marketSymbols[index][0])!.key!,
            },
            wrapSolMintAddress,
          );

        if (openOrderTx) {
          //if there's an instruction for creating OO, we skip the arb and create OO first, add them to cache and use it directly.
          await this.transactionExecutor.sendLegacyTransaction(openOrderTx, [this.payer, ...signers]);
          break;
        } else {
          //sol wrapping & unwrapping can only be done once
          if (wrapWSOLTx && unwrapWSOLTx && !wrapSolTxInstr && !unWrapSolTxInstr) {
            wrapSolTxInstr = wrapWSOLTx.instructions;
            unWrapSolTxInstr = unwrapWSOLTx.instructions;
            wrapSolMintAddress = wrapSolMint!;
          }
          serumSwapTxs!.forEach((tx) => {
            swapInstructions.push(...tx!.instructions);
          });
          signers.forEach((signer) => txSigners.add(signer));
          inputVolume = outAmount!;
          // if (isFirstLeg) {
          //   inputVolume = (PERCENT_INPUT_SERUM / 100) * inputVolume;
          //   isFirstLeg = false;
          // }
        }
      } else if (arbLegs[index].market === DexMarket.RAY) {
        //baseLiquidity/quoteLiquidity = price
        // in bid case, we have base liquidity and price
        // in ask case, we have quote liquidity and price

        const baseLiquidity =
          arbLegs[index].side === Side.Bid
            ? arbitrage.volumes[index]
            : arbitrage.volumes[index] * arbitrage.prices[index];
        const quoteLiquidity =
          arbLegs[index].side === Side.Bid
            ? arbitrage.volumes[index] / arbitrage.prices[index]
            : arbitrage.volumes[index];

        const { createAtaInstr, wrapSolInstr, unwrapSolInstr, swapInstr, wrapSolAta, signers, outAmount } =
          await this.swapBuilder.buildRaydiumSwapInstruction({
            leg: arbLegs[index],
            slippage: slippage,
            inputAmount: inputVolume,
            baseLiquidity: baseLiquidity,
            quoteLiquidity: quoteLiquidity,
            lutAddress: this.dataStore.raydiumMarketsLookupTableAccounts!.get(marketSymbols[index][0])!.key!
          });
        const tx = new Transaction();
        if (createAtaInstr) {
          tx.add(...createAtaInstr!);
          await this.transactionExecutor.sendLegacyTransaction(tx, [this.payer, ...signers!]);
          break;
        } else {
          //sol wrapping & unwrapping can only be done once
          if (wrapSolInstr && unwrapSolInstr && !wrapSolTxInstr && !unWrapSolTxInstr) {
            wrapSolTxInstr = wrapSolInstr!;
            unWrapSolTxInstr = unwrapSolInstr!;
            wrapSolMintAddress = wrapSolAta!;
          }
          swapInstr!.forEach((instr) => swapInstructions.push(instr));
          signers?.forEach((signer) => txSigners.add(signer));
          inputVolume = outAmount!;
        }
      }
    }

    if (wrapSolTxInstr && unWrapSolTxInstr) {
      swapInstructions.unshift(wrapSolTxInstr!);
      swapInstructions.push(unWrapSolTxInstr!);
    }
    if(swapInstructions.length >= 2){
      const tx = await this.createArbitrageTransaction(swapInstructions, marketSymbols);
      await this.transactionExecutor.sendVersionedTransaction(tx, [...txSigners]);
    }
  }

  async createAddressLookupTable(): Promise<PublicKey> {
    while (true) {
      try {
        const tx: Transaction = new Transaction();
        let slot = await this.connection.getSlot("confirmed");
        while (!slot) {
          slot = await this.connection.getSlot("confirmed");
        }
        const [createLutInstr, lutAddress] = AddressLookupTableProgram.createLookupTable({
          authority: this.payer.publicKey,
          payer: this.payer.publicKey,
          recentSlot: slot,
        });
        tx.add(createLutInstr);

        logger.info(`Creating Lut with Address: ${lutAddress.toString()}`);
        await this.transactionExecutor.sendLegacyTransaction(tx, [this.payer]);
        logger.info(`Created Lut with Address: ${lutAddress.toString()}`);
        return lutAddress;
      } catch (error) {
        logger.warn(`Failed to create LUT. Trying again`);
      }
    }
  }

  private async createTokenAccount(tokenMint: PublicKey): Promise<[PublicKey, Transaction]> {
    const tx: Transaction = new Transaction();
    const tokenWalletAddress = await findAssociatedTokenAddress(tokenMint, this.payer.publicKey);
    tx.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        tokenMint,
        tokenWalletAddress,
        this.payer.publicKey,
        this.payer.publicKey,
      ),
    );
    return [tokenWalletAddress, tx];
  }

  async getSerumMarketAddressesForLut(marketSymbol: string): Promise<Array<PublicKey>> {
    const addresses: Array<PublicKey> = [this.payer.publicKey];

    try {
      const baseToken = this.dataStore.tokenMints.get(marketSymbol.split("-")[0])!;
      const quoteToken = this.dataStore.tokenMints.get(marketSymbol.split("-")[1])!;

      if (!baseToken || !quoteToken) {
        logger.warn(`Could not fetch addresses for market: ${marketSymbol}`);
        return [];
      }
      //fetching token account addresses if they exist or creating them and then adding them if they don't
      let baseTokenAccount = this.dataStore.tokenAccounts.get(baseToken.toString());
      let quoteTokenAccount = this.dataStore.tokenAccounts.get(quoteToken.toString());

      const tx: Transaction = new Transaction();

      if (!baseTokenAccount) {
        // console.log(`need to create baseTokenAccount`);
        baseTokenAccount = await getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          baseToken,
          this.payer.publicKey,
        );
        tx.add(
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            baseToken,
            baseTokenAccount,
            this.payer.publicKey,
            this.payer.publicKey,
          ),
        );
        // console.log(`created base token account`);
        this.dataStore.tokenAccounts.set(baseToken.toString(), baseTokenAccount);
      }
      if (!quoteTokenAccount) {
        // console.log(`need to create quoteTokenAccount`);
        quoteTokenAccount = await getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          quoteToken,
          this.payer.publicKey,
        );
        tx.add(
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            quoteToken,
            quoteTokenAccount,
            this.payer.publicKey,
            this.payer.publicKey,
          ),
        );
        logger.info(`Done creating quoteTokenAccount`);
        this.dataStore.tokenAccounts.set(quoteToken.toString(), quoteTokenAccount);
      }

      addresses.push(baseTokenAccount, quoteTokenAccount);

      //Adding Market Specific Addresses
      // console.log(`printing json string market`);
      // console.log(`JSON PARSING MARKET: ${JSON.stringify(this.dataStore.serumMarketKeys.get(marketSymbol)!)}`);
      const targetMaret = JSON.parse(JSON.stringify(this.dataStore.serumMarketKeys.get(marketSymbol)!))["_decoded"];
      addresses.push(
        new PublicKey(targetMaret["baseVault"]),
        new PublicKey(targetMaret["quoteVault"]),
        new PublicKey(targetMaret["eventQueue"]),
        new PublicKey(targetMaret["requestQueue"]),
        new PublicKey(targetMaret["bids"]),
        new PublicKey(targetMaret["asks"]),
        new PublicKey(targetMaret["ownAddress"]),
      );
      //Contant Addresses
      addresses.push(MAINNET_SERUM_DEX_PROGRAM);
      addresses.push(TOKEN_PROGRAM_ID);
      addresses.push(ASSOCIATED_TOKEN_PROGRAM_ID);

      if (tx.instructions.length > 0) {
        await this.transactionExecutor.sendLegacyTransaction(tx, [this.payer]);
      }

      const vaultSigner = await getVaultOwnerAndNonce(
        this.dataStore.serumMarketKeys.get(marketSymbol)!.address,
        MAINNET_SERUM_DEX_PROGRAM,
      );
      addresses.push(vaultSigner);

      return addresses;
    } catch (error) {
      logger.warn(`Error occured while creating market: ${marketSymbol}: ${error}`);
    }
    return [];
  }

  async getRaydiumMarketAddresses(marketSymbol: string): Promise<PublicKey[]> {
    const addresses = this.dataStore.raydiumMarketKeys.get(marketSymbol)!;
    return ([...Object.values(addresses)].filter((address) => {
      return address instanceof PublicKey;
    })) as PublicKey[];
  }

  private chunks<Type>(arr: Array<Type>, start: number, size: number) {
    return [...arr.slice(start, start + size)];
  }

  private async extendLut(lutAddress: PublicKey, addresses: Array<PublicKey>) {
    while (true) {
      try {
        const tx: Transaction = new Transaction();
        logger.info(`Extending LUT with addresses: ${addresses.length}`);
        const extendInstruction = AddressLookupTableProgram.extendLookupTable({
          payer: this.payer.publicKey,
          authority: this.payer.publicKey,
          lookupTable: lutAddress,
          addresses: addresses,
        });
        tx.add(extendInstruction);
        await this.transactionExecutor.sendLegacyTransaction(tx, [this.payer]);
        break;
      } catch (error) {
        logger.warn(`Error when trying to extending the LUT`);
      }
    }
  }

  async populateMarketKeys(connection: Connection, markets: Array<PublicKey>) {
    const marketKeys: any = {};
    for (let key of markets) {
      const info = await fetchPoolKeys(connection, key);
      marketKeys[key.toString()] = info;
      console.log(`fetched keys: ${JSON.stringify(info)}`);
    }
    fs.writeFileSync("marketKeysInfo.json", JSON.stringify(marketKeys));

  }

  async populateRaydiumMarketLuts(){
    const markets = Array.from(SUPPORTED_RAYDIUM_MARKETS_ADDRESSES.keys());
    const chunkSize = 20;
    const marketChunkSize = 15;
    let addresses: Array<PublicKey> = [];
    try {
      for (let i = 0; i < markets.length; i += marketChunkSize) {
        const marketsChunk = this.chunks(markets, i, marketChunkSize);
        for (let market of marketsChunk) {
          const tempAddresses = await this.getRaydiumMarketAddresses(market);
          addresses.push(...tempAddresses);
          if (tempAddresses.length === 0) {
            logger.warn(`Could not fetch addresses for Raydium market: ${market}`);
          } else {
            logger.info(`Added addresses for Raydium ${market} =  ${tempAddresses.length}`);
          }
        }
        const lut = await this.createAddressLookupTable();
        // addresses = [...new Set(addresses)];
        addresses = [...new Set((addresses.map(address => address.toString())))].map(address => new PublicKey(address));

        for (let j = 0; j < addresses.length; j += chunkSize) {
          const addressesChunk = this.chunks(addresses, j, chunkSize);
          await this.extendLut(lut, addressesChunk);
        }
        addresses.splice(0, addresses.length);

        marketsChunk.forEach((marketSymbol) => {
          this.raydiumMarketsLookupTableAddresses.set(marketSymbol, lut);
        });
      }
    } catch (error) {
      logger.error(`Error when populating Raydium Markets LUTs: ${error}`);
      process.exit(-1);
    }

  }

  async populateSerumMarketsLuts() {
    const markets = Array.from(SUPPORTED_SERUM_MARKETS);
    const chunkSize = 20;
    let addresses: Array<PublicKey> = [];
    try {
      for (let i = 0; i < markets.length; i += chunkSize) {
        const marketsChunk = this.chunks(markets, i, chunkSize);
        for (let market of marketsChunk) {
          const tempAddresses = await this.getSerumMarketAddressesForLut(market);
          addresses.push(...tempAddresses);
          if (tempAddresses.length === 0) {
            logger.warn(`Could not fetch addresses for market: ${market}`);
          } else {
            logger.info(`Added addresses for ${market} =  ${tempAddresses.length}`);
          }
        }
        const lut = await this.createAddressLookupTable();
        addresses = [...new Set(addresses)];

        for (let j = 0; j < addresses.length; j += chunkSize) {
          const addressesChunk = this.chunks(addresses, j, chunkSize);
          await this.extendLut(lut, addressesChunk);
        }
        addresses.splice(0, addresses.length);

        marketsChunk.forEach((marketSymbol) => {
          this.serumMarketsLookupTableAddresses.set(marketSymbol, lut);
        });
      }
    } catch (error) {
      logger.error(`Error when populating Serum Markets LUTs: ${error}`);
      process.exit(-1);
    }
  }

  /**
   * loads only serum luts. If the exist in cache, it reads them and populates them.
   * Otherwise, it creates them and saves them to cache
   */
  async loadOrCreateLUTs() {
    let needsCreation = false;
    const lutDir = `${TRANSACTION_LOGS_DIR}/address-lookup-tables`;

    if (!fs.existsSync(lutDir)) {
      fs.mkdirSync(lutDir);
    }

    const lutStoreFilePath = `${lutDir}/alts.json`;
    // populating serum markets
    if (!fs.existsSync(lutStoreFilePath)) {
      needsCreation = true;
    } else {
      //file exists
      const rawData = fs.readFileSync(lutStoreFilePath, "utf-8");
      if (rawData) {
        const lutCache = JSON.parse(rawData);
        if (Object.keys(lutCache).length === 0 && Object.keys(lutCache["Serum"]).length === 0) {
          needsCreation = true;
        } else {
          logger.info(`Populating Serum Address Lookup Tables from cache`);
          for (let key of Object.keys(lutCache["Serum"])) {
            this.serumMarketsLookupTableAddresses.set(key, new PublicKey(lutCache["Serum"][key]));
          }
          logger.info(`Serum Address Lookup Tables populated from cache`);
        }
      } else {
        needsCreation = true;
      }
    }
    if (needsCreation) {
      logger.info(`Creating Address Lookup Tables`);
      await this.populateSerumMarketsLuts();
      logger.info(`Address Lookup Tables created`);
      const lutsCache: AddressLookupTableCache = {
        Serum: {},
      };
      for (let [key, val] of this.serumMarketsLookupTableAddresses) {
        lutsCache["Serum"][key] = val.toString();
      }
      fs.writeFileSync(lutStoreFilePath, JSON.stringify(lutsCache));
    }

    let rayLutNeedsCreation = false;
    const rayLutStoreFilePath = `${lutDir}/raydium-alts.json`;

    if (!fs.existsSync(rayLutStoreFilePath)) {
      rayLutNeedsCreation = true;
    } else {
      //file exists
      const rawData = fs.readFileSync(rayLutStoreFilePath, "utf-8");
      if (rawData) {
        const lutCache = JSON.parse(rawData);
        if (Object.keys(lutCache).length === 0 && Object.keys(lutCache["Raydium"]).length === 0) {
          rayLutNeedsCreation = true;
        } else {
          logger.info(`Populating Raydium Address Lookup Tables from cache`);
          for (let key of Object.keys(lutCache["Raydium"])) {
            this.raydiumMarketsLookupTableAddresses.set(key, new PublicKey(lutCache["Raydium"][key]));
          }
          logger.info(`Raydium Address Lookup Tables populated from cache`);
        }
      } else {
        rayLutNeedsCreation = true;
      }
    }

    if (rayLutNeedsCreation) {
      logger.info(`Creating Raydium Address Lookup Tables`);
      await this.populateRaydiumMarketLuts();
      logger.info(`Raydium Address Lookup Tables created`);
      const lutsCache: AddressLookupTableCache = {
        Raydium: {},
      };
      for (let [key, val] of this.raydiumMarketsLookupTableAddresses) {
        lutsCache["Raydium"][key] = val.toString();
      }
      fs.writeFileSync(rayLutStoreFilePath, JSON.stringify(lutsCache));
    }

    await this.dataStore.populateSerumMarketsLookupTableAccounts(
      this.connection,
      this.serumMarketsLookupTableAddresses,
    );

    await this.dataStore.populateRaydiumMarketLookupTableAccounts(
      this.connection,
      this.raydiumMarketsLookupTableAddresses
    );
  }
}

//Since we will be using luts for v2, when the program starts, we need to check if lut exists in cache files and use that.
//if lut does not exist in cache, create for each dex i.e serum and raydium and add market, tokens and required program addresses into that
//Compile a V2 and send that for execution

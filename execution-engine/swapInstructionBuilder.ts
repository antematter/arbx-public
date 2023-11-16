/**
 * Responsibilities
 *   has access to datastore containing data about all supported dexes
 *   Constructs swap Instruction for raydium
 *   Construct Swap instruction for Serum
 *
 */

import { Connection, Keypair, PublicKey, Signer, Transaction } from "@solana/web3.js";
import { DataStore } from "./dataStore";
import {
  Leg,
  RaydiumSwapInstruction,
  RaydiumSwapParams,
  SerumSwapInstruction,
  SerumSwapParams,
  Side,
  SwapBuilderParams,
  SwapLegTransaction,
} from "./types";
import { createSerumSwapInstruction } from "./serum-backend";
import { createRaydiumSwapInstruction } from "./raydium-backend";

export class SwapInstructionBuilder {
  private connection: Connection;
  private payer: Keypair;
  private dataStore: DataStore;

  constructor(params: SwapBuilderParams) {
    this.connection = params.connection;
    this.payer = params.payer;
    this.dataStore = params.datastore;
  }

  async buildSerumSwapInstruction(params: SerumSwapParams, wrapSolMint?: PublicKey): Promise<SerumSwapInstruction> {
    //build a serum Swap instruction by passing in the right parameters from the data store and params to Serum Backend
    return await createSerumSwapInstruction(this.connection, this.payer, this.dataStore, params, wrapSolMint);
  }
  async buildRaydiumSwapInstruction(params: RaydiumSwapParams): Promise<RaydiumSwapInstruction> {
    return await createRaydiumSwapInstruction(this.connection, this.dataStore, this.payer, params);
  }
}

//TODO Left
/**
 * Identify which addresses are to be added in the lut from solana explore on both serum and raydium markets
 * Add Support for performing inter-market swaps
 * Add Transaction V2 and LUT support
 * Add execution engine
 *
 * Test More Swaps on Serum
 * Test more swaps on RAydium
 *
 * Add ORca Backend?
 */

//Since we will be using luts for v2, when the program starts, we need to check if lut exists in cache files and use that.
//if lut does not exist in cache, create for each dex i.e serum and raydium and add market, tokens and required program addresses into that
//Compile a V2 and send that for execution

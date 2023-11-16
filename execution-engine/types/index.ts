import { Connection, Keypair, PublicKey, Signer, Transaction, TransactionInstruction } from "@solana/web3.js";
import { DataStore } from "../dataStore";

export enum Side {
  Ask,
  Bid,
}

export enum DexMarket {
  SRM = <any>"SRM",
  RAY = <any>"RAY",
  ORCA = <any>"ORCA",
}

export type Leg = {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseMintDecimals: number;
  quoteMintDecimals: number;
  side: Side;
  market: DexMarket
};

export interface SwapBuilderParams {
  connection: Connection;
  payer: Keypair;
  datastore: DataStore;
}

export interface RaydiumSwapParams {
  leg: Leg;
  slippage: number;
  inputAmount: number;
  baseLiquidity: number,
  quoteLiquidity: number,
  lutAddress: PublicKey
}

export interface SerumSwapParams {
  leg: Leg;
  slippage: number;
  inputAmount: number;
  routeFare: number;
  lutAddress: PublicKey;
}

export interface SwapLegTransaction {
  transaction: Transaction;
  signers: Signer[];
  outAmount: number;
}

export interface Arbitrage {
  prices: Array<number>;
  volumes: Array<number>;
  tokens: Array<string>;
  markets: Array<DexMarket>;
  profit_potential: number;
  trades: Array<Side>;
}
export interface SerumSwapInstruction {
  serumSwapTxs?: Transaction[];
  openOrderTx?: Transaction;
  wrapWSOLTx?: Transaction;
  unwrapWSOLTx?: Transaction;
  wrapSolMint?: PublicKey;
  signers: Signer[];
  outAmount?: number;
}

export interface RaydiumSwapInstruction {
  createAtaInstr?: TransactionInstruction[],
  wrapSolInstr?: TransactionInstruction[] 
  unwrapSolInstr?: TransactionInstruction[], 
  swapInstr?: TransactionInstruction[], 
  wrapSolAta?: PublicKey,
  signers?: Signer[], 
  outAmount? : number,
}

export interface ArbXConfig {
  privateKey: string;
  targetToken: string;
  slippage: number;
  inputAmount: number;
  keypair?: Keypair;
}

export enum Dex {
  Orca,
  Raydium
}

export enum BuySide {
  Quote,
  Base
}

type CommonArbitrageParams = {
  firstToken: string,
  secondToken: string,
  buySide: BuySide,
}

export type SwapParams = CommonArbitrageParams & {
  swapAmount: number,
}

export type ArbLegParams = CommonArbitrageParams & {
  dex: Dex
}

export type RawArbitrage = {
  prices: number[],
  volumes: number[],
  tokens: string[],
  markets: string[],
  profit_potential: number,
  trades: string[],
  timestamp: string
}

export type DexException = {
  logs: string[];
  message: string;
  stack: string;
}

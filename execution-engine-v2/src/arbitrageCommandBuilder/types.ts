import BN from "bn.js";
import { Market } from "@project-serum/serum";
import { LiquidityPoolKeys } from "@raydium-io/raydium-sdk";
import { AssosiatedTokenAccount, TokenData } from "../tokens";
import { AutomateMarketMakers, TxInstruction } from "../types";
import { AddressLookupTableAccount, PublicKey } from "@solana/web3.js";
import { OrcaPoolParams } from "@orca-so/sdk/dist/model/orca/pool/pool-types";
import { OrcaPoolToken, OrcaU64 } from "@orca-so/sdk";

export interface SwapCommand {
    fromAta: AssosiatedTokenAccount;
    toAta: AssosiatedTokenAccount;
    fromToken: TokenData;
    toToken: TokenData;
    inputAmount: number;
    outputAmount: number;
    amm: AutomateMarketMakers;
}

export interface OrcaSwapCommand extends SwapCommand {
    inputPoolToken: OrcaPoolToken;
    outputPoolToken: OrcaPoolToken;
    minimumOutputAmount: OrcaU64;
    poolParameters: OrcaPoolParams;
}

export interface SerumSwapCommand extends SwapCommand {
    minExchangeRate: BN;
    openOrderAccount: PublicKey;
    marketKeys: Market;
}

export interface RaydiumSwapCommand extends SwapCommand {
    baseLiquidity: number;
    quoteLiquidity: number;
    marketKeys: LiquidityPoolKeys;
}

export interface ArbitrageCommand {
    swapLegs: Array<SwapCommand>;
    luts: Array<AddressLookupTableAccount>;
    wrapSol?: TxInstruction[];
    unwrapSol?: TxInstruction;
    solAta?: PublicKey;
    trueProfitPotential: number;
}

export interface ISwapParams {
    inputVolume: number;
    fromAta: AssosiatedTokenAccount;
    toAta: AssosiatedTokenAccount;
    fromToken: TokenData;
    toToken: TokenData;
    slippage: number;
    marketSymbol: string;
}

export interface SerumSwapParams extends ISwapParams {
    routeFare: number;
    openOrderAccount: PublicKey;
    marketKeys: Market;
}

export interface RaydiumSwapParams extends ISwapParams {
    reserve: number;
    price: number;
    marketKeys: LiquidityPoolKeys;
}

export interface OrcaSwapParams extends ISwapParams {
    fromTokenVolume: number;
    fromTokenPrice: number;
    poolParameters: OrcaPoolParams;
}

export interface ISwapBuilder {
    buildSwap(params: ISwapParams): SwapCommand;
}

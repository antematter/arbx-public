import { CurrencyAmount, Liquidity, Percent, Price, Token, TokenAmount } from "@raydium-io/raydium-sdk";

import { AddressLookupTableProgram, Connection, Keypair, Transaction } from "@solana/web3.js";
import { DataStore } from "../dataStore";
import { computeAmountOut } from "./utils";
import { RaydiumSwapInstruction, RaydiumSwapParams, Side } from "../types";
import BN from "bn.js";
import logger from "../logger";

export async function createRaydiumSwapInstruction(
  connection: Connection,
  ds: DataStore,
  payer: Keypair,
  params: RaydiumSwapParams,
): Promise<RaydiumSwapInstruction> {
  const marketSymbol = `${ds.mintTokens.get(params.leg.baseMint.toString())!}-${ds.mintTokens.get(
    params.leg.quoteMint.toString(),
  )!}`;

  const poolKeys = ds.raydiumMarketKeys.get(marketSymbol)!;

  const baseMint = params.leg.side === Side.Ask ? params.leg.baseMint : params.leg.quoteMint;
  const quoteMint = params.leg.side === Side.Ask ? params.leg.quoteMint : params.leg.baseMint;

  const baseReserve = new BN(params.baseLiquidity);
  const quoteReserve = new BN(params.quoteLiquidity);

  const slippage = new Percent(params.slippage, 100);

  let amountIn: TokenAmount | CurrencyAmount;
  let currencyOut: Token;

  let amount_out: TokenAmount | CurrencyAmount,
    min_amount_out: TokenAmount | CurrencyAmount,
    current_price: Price,
    execution_price: Price | null,
    price_impact: Percent,
    fee_charged: CurrencyAmount;

  if (params.leg.side === Side.Bid) {
    amountIn = new TokenAmount(
      new Token(params.leg.quoteMint, params.leg.quoteMintDecimals),
      params.inputAmount,
      false,
    );
    currencyOut = new Token(params.leg.baseMint, params.leg.baseMintDecimals);
    const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } = computeAmountOut(
      baseMint,
      quoteMint,
      baseReserve,
      quoteReserve,
      amountIn,
      currencyOut,
      slippage,
    );
    amount_out = amountOut;
    min_amount_out = minAmountOut;
    current_price = currentPrice;
    execution_price = executionPrice;
    price_impact = priceImpact;
    fee_charged = fee;
  } else {
    amountIn = new TokenAmount(new Token(params.leg.baseMint, params.leg.baseMintDecimals), params.inputAmount, false);
    currencyOut = new Token(params.leg.quoteMint!, params.leg.quoteMintDecimals);
    const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } = computeAmountOut(
      baseMint,
      quoteMint,
      baseReserve,
      quoteReserve,
      amountIn,
      currencyOut,
      slippage,
    );
    amount_out = amountOut;
    min_amount_out = minAmountOut;
    current_price = currentPrice;
    execution_price = executionPrice;
    price_impact = priceImpact;
    fee_charged = fee;
  }

  const prices = {
    amount_out: amount_out.toFixed(),
    min_amount_out: min_amount_out.toFixed(),
    current_price: current_price.toFixed(),
    execution_price: execution_price?.toFixed(),
    price_impact: price_impact.toFixed(),
    fee_charged: fee_charged.toFixed(),
  };

  logger.debug(`trade prices details: ${JSON.stringify(prices, null, 4)}`);

  const outputAmount = Number(amount_out.toFixed());

  const { ataAddress, mint, createAtaInstr, wrapSolInstr, unwrapSolInstr, signers, swapInstr, wrapSolAta } =
    await Liquidity.makeCustomSwapInstruction({
      connection: connection,
      poolKeys: poolKeys,
      userKeys: {
        tokenAccounts: ds.tokenAccounts,
        owner: payer.publicKey,
      },
      amountIn: amountIn,
      amountOut: min_amount_out,
      fixedSide: "in",
    });

  if (ataAddress && mint) {
    ds.tokenAccounts.set(mint!.toString(), ataAddress!);
    //extending the lut with the ATA account
    createAtaInstr!.push(
      AddressLookupTableProgram.extendLookupTable({
        payer: payer.publicKey,
        authority: payer.publicKey,
        lookupTable: params.lutAddress,
        addresses: [ataAddress!],
      }),
    );
  }

  return {
    swapInstr,
    signers,
    wrapSolInstr,
    unwrapSolInstr,
    createAtaInstr,
    wrapSolAta,
    outAmount: outputAmount,
  };

  // return {
  //   ...(await Liquidity.makeSwapTransaction({
  //     connection,
  //     poolKeys,
  //     userKeys: {
  //       tokenAccounts: ds.tokenAccountsArray,
  //       owner,
  //     },
  //     amountIn,
  //     amountOut: min_amount_out,
  //     fixedSide: "in",
  //   })),
  //   outAmount: Number(amount_out.toFixed()),
  // };
}

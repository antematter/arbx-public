import {
  AmountSide,
  CurrencyAmount,
  Liquidity,
  LiquidityComputeAmountInParams,
  LiquidityComputeAmountOutParams,
  LiquidityPoolKeys,
  Percent,
  Price,
  Token,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import { AccountMeta, Connection, PublicKey, Signer, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getDxByDyBaseIn, getDyByDxBaseIn, getStablePrice, stableModelLayout } from "./stable";
import BN from "bn.js";

export const ZERO = new BN(0);
export const ONE = new BN(1);

export const LIQUIDITY_FEES_NUMERATOR = new BN(1);
export const LIQUIDITY_FEES_DENOMINATOR = new BN(1);

let modelData: stableModelLayout = {
  accountType: 0,
  status: 0,
  multiplier: 0,
  validDataCount: 0,
  DataElement: [],
};

function getTokenSide(token: Token, baseMint: PublicKey, quoteMint: PublicKey): AmountSide {
  if (token.mint.equals(baseMint)) return "base";
  else if (token.mint.equals(quoteMint)) return "quote";
  else throw Error("token not match with pool");
}

function getAmountSide(amount: CurrencyAmount | TokenAmount, baseMint: PublicKey, quoteMint: PublicKey): AmountSide {
  const token = amount instanceof TokenAmount ? amount.token : Token.WSOL;
  return getTokenSide(token, baseMint, quoteMint);
}

/**
 * Compute output currency amount of swap
 *
 * @param params - {@link LiquidityComputeAmountOutParams}
 *
 * @returns
 * amountOut - currency amount without slippage
 * @returns
 * minAmountOut - currency amount with slippage
 */
export function computeAmountOut(
  baseMint: PublicKey,
  quoteMint: PublicKey,
  baseReserve: BN,
  quoteReserve: BN,
  amountIn: TokenAmount | CurrencyAmount,
  currencyOut: Token,
  slippage: number,
):
  | {
      amountOut: CurrencyAmount;
      minAmountOut: CurrencyAmount;
      currentPrice: Price;
      executionPrice: Price | null;
      priceImpact: Percent;
      fee: CurrencyAmount;
    }
  | {
      amountOut: TokenAmount;
      minAmountOut: TokenAmount;
      currentPrice: Price;
      executionPrice: Price | null;
      priceImpact: Percent;
      fee: CurrencyAmount;
    } {
  console.log(`base reserve: ${baseReserve.toString()}`);
  console.log(`quote reserve: ${quoteReserve.toString()}`);

  const currencyIn = amountIn instanceof TokenAmount ? amountIn.token : amountIn.currency;
  const reserves = [baseReserve, quoteReserve];
  // input is fixed
  const input = getAmountSide(amountIn, baseMint, quoteMint);

  if (input === "quote") {
    reserves.reverse();
  }

  const [reserveIn, reserveOut] = reserves;
  const RAYDIUM_PROTOCOL_VERSION = 4;

  let currentPrice;
  if (RAYDIUM_PROTOCOL_VERSION === 4) {
    currentPrice = new Price(currencyIn, reserveIn, currencyOut, reserveOut); //(reserveIn / reserver out)
  } else {
    const p = getStablePrice(modelData, baseReserve.toNumber(), quoteReserve.toNumber(), false);
    if (input === "quote") currentPrice = new Price(currencyIn, new BN(p * 1e6), currencyOut, new BN(1e6));
    else currentPrice = new Price(currencyIn, new BN(1e6), currencyOut, new BN(p * 1e6));
  }

  const amountInRaw = amountIn.raw;
  let amountOutRaw = ZERO;
  let feeRaw = ZERO;

  if (!amountInRaw.isZero()) {
    if (RAYDIUM_PROTOCOL_VERSION === 4) {
      const amountInWithFee = amountInRaw;
      // @ts-ignore
      const denominator = reserveIn.add(amountInWithFee);
      // @ts-ignore
      amountOutRaw = reserveOut.mul(amountInWithFee).div(denominator);
    } else {
      const amountInWithFee = amountInRaw;
      if (input === "quote")
        amountOutRaw = new BN(
          getDyByDxBaseIn(modelData, quoteReserve.toNumber(), baseReserve.toNumber(), amountInWithFee.toNumber()),
        );
      else {
        amountOutRaw = new BN(
          getDxByDyBaseIn(modelData, quoteReserve.toNumber(), baseReserve.toNumber(), amountInWithFee.toNumber()),
        );
      }
    }
  }
  const _slippage = new Percent(ONE).add(slippage);
  console.log(`Slippage being used: ${_slippage.toFixed(6)}`);
  const minAmountOutRaw = _slippage.invert().mul(amountOutRaw).quotient;

  const amountOut =
    currencyOut instanceof Token
      ? new TokenAmount(currencyOut, amountOutRaw)
      : new CurrencyAmount(currencyOut, amountOutRaw);
  const minAmountOut =
    currencyOut instanceof Token
      ? new TokenAmount(currencyOut, minAmountOutRaw)
      : new CurrencyAmount(currencyOut, minAmountOutRaw);

  let executionPrice = new Price(currencyIn, amountInRaw.sub(feeRaw), currencyOut, amountOutRaw);
  if (!amountInRaw.isZero() && !amountOutRaw.isZero()) {
    executionPrice = new Price(currencyIn, amountInRaw.sub(feeRaw), currencyOut, amountOutRaw);
  }
  const priceImpact = new Percent(
    parseInt(String(Math.abs(parseFloat(executionPrice.toFixed()) - parseFloat(currentPrice.toFixed())) * 1e9)),
    parseInt(String(parseFloat(currentPrice.toFixed()) * 1e9)),
  );
  const fee =
    currencyIn instanceof Token ? new TokenAmount(currencyIn, feeRaw) : new CurrencyAmount(currencyIn, feeRaw);

  return {
    amountOut,
    minAmountOut,
    currentPrice,
    executionPrice,
    priceImpact,
    fee,
  };
}

function computePriceImpact(currentPrice: Price, amountIn: BN, amountOut: BN) {
  const exactQuote = currentPrice.raw.mul(amountIn);
  // calculate slippage := (exactQuote - outputAmount) / exactQuote
  const slippage = exactQuote.sub(amountOut).div(exactQuote);
  return new Percent(slippage.numerator, slippage.denominator);
}

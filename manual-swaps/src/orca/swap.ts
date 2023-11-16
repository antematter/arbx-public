import Decimal from "decimal.js";
import {  Percentage } from "@orca-so/sdk";
import { logger } from "../../utils/logger";
import { executeTransaction, getPool } from "./utils";
import { SwapParams, BuySide } from "../../utils/types";
import { getBothPossibleTokenPairs } from "../../utils/helpers";
import { ORCA_PREFIX, OWNER, SLIPPAGE } from "../../utils/constants";


export async function swapOnOrca(swapParams: SwapParams): Promise<number> {
  logger.info(`${ORCA_PREFIX} Initiating swap`);

  const [firstPair, secondPair] = getBothPossibleTokenPairs(
    swapParams.firstToken,
    swapParams.secondToken
  );
  const pool = getPool(firstPair, secondPair);
  const fromToken = swapParams.buySide === BuySide.Base 
                    ? pool.getTokenA() 
                    : pool.getTokenB();

  const swapAmountAsDecimal = new Decimal(swapParams.swapAmount);
  const slippage = Percentage.fromFraction(SLIPPAGE, 100);

  const quote = await pool.getQuote(
    fromToken,
    swapAmountAsDecimal,
    slippage.toDecimal()
  );
  const expectedOutputAmount = quote.getExpectedOutputAmount().toNumber();
  const minOutputAmount = quote.getMinOutputAmount().toNumber();

  logger.info(
    `${ORCA_PREFIX} Expected output amount: ${expectedOutputAmount} | Minimum amount: ${minOutputAmount}`
  );

  const payload = await pool.swap(
    OWNER,
    fromToken,
    swapAmountAsDecimal,
    quote.getMinOutputAmount()
  );

  await executeTransaction(payload);
  return expectedOutputAmount;
}
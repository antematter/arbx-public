import chalk from 'chalk';
import { logger } from '../utils/logger';
import { isStablePool } from '../src/orca/utils';
import { ArbitrageExecutor } from "../src/arb-executor";
import { INITIAL_SWAP_DOLLAR_AMOUNT } from '../utils/constants';
import { BuySide, Dex, ArbLegParams, RawArbitrage } from "../utils/types";


function convertRawArbitrage(rawArb: RawArbitrage): ArbLegParams[] {
  const dexArbitrages: ArbLegParams[] = [];
  const numArbs = rawArb.markets.length;

  for (let i = 0; i < numArbs; i++) {
    const firstToken = rawArb.tokens[i].toUpperCase();
    const secondToken = rawArb.tokens[i + 1].toUpperCase();
    
    if (
      (rawArb.markets[i] !== "ORCA" && rawArb.markets[i] !== "RAY") ||
      (rawArb.markets[i] === "ORCA" && isStablePool(firstToken, secondToken)) ||
      (firstToken === "ETH" || secondToken === "ETH")
    ) {
      logger.info(`${chalk.red("Arb Skipped!")}`)
      return [];
    }
    dexArbitrages.push({
      firstToken: rawArb.tokens[i].toUpperCase(),
      secondToken: rawArb.tokens[i + 1].toUpperCase(),
      buySide: rawArb.trades[i] === "BID" ? BuySide.Base : BuySide.Quote,
      dex: rawArb.markets[i] === "ORCA" ? Dex.Orca : Dex.Raydium
    })
  }
  return dexArbitrages;
}

export async function executeRawArbitrage(
  rawArb: RawArbitrage,
  startingAmount?: number
): Promise<void> {
  try {
    const arbExecutor = new ArbitrageExecutor();
    const arbLegs = convertRawArbitrage(rawArb);
    if (arbLegs.length === 0) {
      return;
    }
    logger.info(
      `\n${chalk.magenta.bold("[INFO]")} Executing arb: ${JSON.stringify(
        rawArb
      )}`
    );
    for (const arbLeg of arbLegs) {
      arbExecutor.queueArbitrageLeg(arbLeg);
    }
    if (startingAmount) {
      await arbExecutor.execute(startingAmount);
    }
    else {
      await arbExecutor.execute(INITIAL_SWAP_DOLLAR_AMOUNT, true);
    }
  } catch (error) {
    logger.info(`${chalk.red("[ERROR]")} Error processing arbitrage:`, error);
  }
}

import { calculateProfit, toDecimal } from './utils';
import cache from './cache';
import { getSwapResultFromSolscanParser } from './solscan';

const swap = async (jupiter, route) => {
  try {
    const performanceOfTxStart = performance.now();
    cache.performanceOfTxStart = performanceOfTxStart;

    const { execute } = await jupiter.exchange({
      routeInfo: route,
    });
    const result = await execute();
    const performanceOfTx = performance.now() - performanceOfTxStart;

    return [result, performanceOfTx];
  } catch (error) {
    console.log('Swap error: ', error);
  }
};

const _swap = swap;
export { _swap as swap };

const failedSwapHandler = (tradeEntry) => {
  // update counter
  cache.tradeCounter[cache.sideBuy ? 'buy' : 'sell'].fail++;

  // update trade history
  let tempHistory = cache.tradeHistory;
  tempHistory.push(tradeEntry);
  cache.tradeHistory = tempHistory;
};

const _failedSwapHandler = failedSwapHandler;
export { _failedSwapHandler as failedSwapHandler };

const successSwapHandler = async (tx, tradeEntry, tokenA, tokenB) => {
  // update counter
  cache.tradeCounter[cache.sideBuy ? 'buy' : 'sell'].success++;

  if (cache.config.tradingStrategy === 'pingpong') {
    // update balance
    if (cache.sideBuy) {
      cache.lastBalance.tokenA = cache.currentBalance.tokenA;
      cache.currentBalance.tokenA = 0;
      cache.currentBalance.tokenB = tx.outputAmount;
    } else {
      cache.lastBalance.tokenB = cache.currentBalance.tokenB;
      cache.currentBalance.tokenB = 0;
      cache.currentBalance.tokenA = tx.outputAmount;
    }

    // update profit
    if (cache.sideBuy) {
      cache.currentProfit.tokenA = 0;
      cache.currentProfit.tokenB = calculateProfit(
        cache.initialBalance.tokenB,
        cache.currentBalance.tokenB
      );
    } else {
      cache.currentProfit.tokenB = 0;
      cache.currentProfit.tokenA = calculateProfit(
        cache.initialBalance.tokenA,
        cache.currentBalance.tokenA
      );
    }

    // update trade history
    let tempHistory = cache.tradeHistory;

    tradeEntry.inAmount = toDecimal(
      tx.inputAmount,
      cache.sideBuy ? tokenA.decimals : tokenB.decimals
    );
    tradeEntry.outAmount = toDecimal(
      tx.outputAmount,
      cache.sideBuy ? tokenB.decimals : tokenA.decimals
    );

    tradeEntry.profit = calculateProfit(
      cache.lastBalance[cache.sideBuy ? 'tokenB' : 'tokenA'],
      tx.outputAmount
    );
    tempHistory.push(tradeEntry);
    cache.tradeHistory = tempHistory;
  }

  if (cache.config.tradingStrategy === 'arbitrage') {
    /** check real amounts on solscan because Jupiter SDK returns wrong amounts
     *  when we trading TokenA <> TokenA (arbitrage)
     */
    const [inAmountFromSolscanParser, outAmountFromSolscanParser] =
      await getSwapResultFromSolscanParser(tx?.txid);

    if (inAmountFromSolscanParser === -1)
      throw new Error(
        `Solscan inputAmount error\n	https://solscan.io/tx/${tx.txid}`
      );
    if (outAmountFromSolscanParser === -1)
      throw new Error(
        `Solscan outputAmount error\n	https://solscan.io/tx/${tx.txid}`
      );

    cache.lastBalance.tokenA = cache.currentBalance.tokenA;
    cache.currentBalance.tokenA = outAmountFromSolscanParser;

    cache.currentProfit.tokenA = calculateProfit(
      cache.initialBalance.tokenA,
      cache.currentBalance.tokenA
    );

    // update trade history
    let tempHistory = cache.tradeHistory;

    tradeEntry.inAmount = toDecimal(inAmountFromSolscanParser, tokenA.decimals);
    tradeEntry.outAmount = toDecimal(
      outAmountFromSolscanParser,
      tokenA.decimals
    );

    tradeEntry.profit = calculateProfit(
      cache.lastBalance['tokenA'],
      outAmountFromSolscanParser
    );
    tempHistory.push(tradeEntry);
    cache.tradeHistory = tempHistory;
  }
};

const _successSwapHandler = successSwapHandler;
export { _successSwapHandler as successSwapHandler };

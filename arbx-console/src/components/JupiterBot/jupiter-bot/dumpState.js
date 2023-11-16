import moment from 'moment';
import { toDecimal } from './utils';
import cache from './cache';

function dumpState(
  {
    date,
    i,
    performanceOfRouteComp,
    inputToken,
    outputToken,
    tokenA,
    tokenB,
    route,
    simulatedProfit
  },
  callback
) {
  try {
    // update max profitability spotted chart
    let spottetMaxTemp = cache.chart.spottedMax[cache.sideBuy ? 'buy' : 'sell'];
    spottetMaxTemp.shift();
    spottetMaxTemp.push(simulatedProfit === Infinity ? 0 : parseFloat(simulatedProfit.toFixed(2)));
    cache.chart.spottedMax.buy = spottetMaxTemp;

    // update performance chart
    let performanceTemp = cache.chart.performanceOfRouteComp;
    performanceTemp.shift();
    performanceTemp.push(parseInt(performanceOfRouteComp.toFixed()));
    cache.chart.performanceOfRouteComp = performanceTemp;

    // check swap / fetch result status
    let statusMessage = '';
    let statusPerformance;

    if (cache.swappingRightNow) {
      statusPerformance = performance.now() - cache.performanceOfTxStart;
      statusMessage = `SWAPPING ... ${(statusPerformance / 1000).toFixed(2)} s`;
    } else if (cache.fetchingResultsFromSolscan) {
      statusPerformance = performance.now() - cache.fetchingResultsFromSolscanStart;
      statusMessage = `FETCHING RESULT ... ${(statusPerformance / 1000).toFixed(2)} s`;
    }

    callback({
      started: moment(cache.startTime).fromNow(),
      timestamp: date.toLocaleString(),
      tradingToken: inputToken.symbol,
      lookupLatency: performanceOfRouteComp.toFixed(),
      minInterval: cache.config.minInterval,
      queueStatus: `${Object.keys(cache.queue).length}/${cache.queueThrottle} tx`,
      routes: cache.availableRoutes[cache.sideBuy ? 'buy' : 'sell'],
      strategy: cache.config.tradingStrategy,
      statusMessage: statusMessage,
      totalSuccessfulBuys: cache.tradeCounter.buy.success,
      totalSuccessfulSells: cache.tradeCounter.sell.success,
      totalFailedBuys: cache.tradeCounter.buy.fail,
      totalFailedSells: cache.tradeCounter.sell.fail,
      profit: simulatedProfit.toFixed(2),
      slippage: cache.config.slippage,
      latestInAmount: toDecimal(route.inAmount, inputToken.decimals),
      latestOutAmount: toDecimal(route.outAmount, outputToken.decimals),
      profitData: cache.chart.spottedMax[cache.sideBuy ? 'buy' : 'sell'],
      maxBuy: cache.maxProfitSpotted.buy.toFixed(2),
      maxSell: cache.maxProfitSpotted.sell.toFixed(2),
      tokenADetails: {
        currentBalance: toDecimal(cache.currentBalance.tokenA, tokenA.decimals),
        lastBalance: toDecimal(cache.lastBalance.tokenA, tokenA.decimals),
        initialBalance: toDecimal(cache.initialBalance.tokenA, tokenA.decimals)
      },
      tradeHistory: cache.tradeHistory
    });
  } catch (error) {
    console.error(error);
  }
}

export { dumpState };

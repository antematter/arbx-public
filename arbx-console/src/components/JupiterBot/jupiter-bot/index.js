import { PublicKey } from '@solana/web3.js';
import {
  calculateProfit,
  toDecimal,
  toNumber,
  updateIterationsPerMin,
  checkRoutesResponse
} from './utils';
import { logExit } from './exit';
import cache, { cacheClone } from './cache';
import { setup, getInitialOutAmountWithSlippage } from './setup';
import { dumpState } from './dumpState';
import { swap, failedSwapHandler, successSwapHandler } from './swap';
import defaultConfig from './data/config.json';

const pingpongStrategy = async (jupiter, tokenA, tokenB, callback) => {
  cache.iteration++;
  const date = new Date();
  const i = cache.iteration;
  cache.queue[i] = -1;

  try {
    // calculate & update iterations per minute
    updateIterationsPerMin(cache);

    // Calculate amount that will be used for trade
    const amountToTrade =
      cache.config.tradeSize.strategy === 'cumulative'
        ? cache.currentBalance[cache.sideBuy ? 'tokenA' : 'tokenB']
        : cache.initialBalance[cache.sideBuy ? 'tokenA' : 'tokenB'];

    const baseAmount = cache.lastBalance[cache.sideBuy ? 'tokenB' : 'tokenA'];

    // default slippage
    const slippage = typeof cache.config.slippage === 'number' ? cache.config.slippage : 1;

    // set input / output token
    const inputToken = cache.sideBuy ? tokenA : tokenB;
    const outputToken = cache.sideBuy ? tokenB : tokenA;

    // check current routes
    const performanceOfRouteCompStart = performance.now();
    const routes = await jupiter.computeRoutes({
      inputMint: new PublicKey(inputToken.address),
      outputMint: new PublicKey(outputToken.address),
      inputAmount: amountToTrade,
      slippage,
      forceFetch: true
    });

    checkRoutesResponse(routes);

    // count available routes
    cache.availableRoutes[cache.sideBuy ? 'buy' : 'sell'] = routes.routesInfos.length;

    // update status as OK
    cache.queue[i] = 0;

    const performanceOfRouteComp = performance.now() - performanceOfRouteCompStart;

    // choose first route
    const route = await routes.routesInfos[0];

    // update slippage with "profit or kill" slippage
    if (cache.config.slippage === 'profitOrKill') {
      route.outAmountWithSlippage = cache.lastBalance[cache.sideBuy ? 'tokenB' : 'tokenA'];
    }

    // calculate profitability
    let simulatedProfit = calculateProfit(baseAmount, await route.outAmount);

    // store max profit spotted
    if (simulatedProfit > cache.maxProfitSpotted[cache.sideBuy ? 'buy' : 'sell']) {
      cache.maxProfitSpotted[cache.sideBuy ? 'buy' : 'sell'] = simulatedProfit;
    }

    dumpState(
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
    );

    // check profitability and execute tx
    let tx, performanceOfTx;
    if (
      !cache.swappingRightNow &&
      (cache.hotkeys.e || cache.hotkeys.r || simulatedProfit >= cache.config.minPercProfit)
    ) {
      // hotkeys
      if (cache.hotkeys.e) {
        console.log('[E] PRESSED - EXECUTION FORCED BY USER!');
        cache.hotkeys.e = false;
      }
      if (cache.hotkeys.r) {
        console.log('[R] PRESSED - REVERT BACK SWAP!');
        route.outAmountWithSlippage = 0;
      }

      if (cache.tradingEnabled || cache.hotkeys.r) {
        cache.swappingRightNow = true;
        // store trade to the history
        let tradeEntry = {
          date: date.toLocaleString(),
          buy: cache.sideBuy,
          inputToken: inputToken.symbol,
          outputToken: outputToken.symbol,
          inAmount: toDecimal(route.inAmount, inputToken.decimals),
          expectedOutAmount: toDecimal(route.outAmount, outputToken.decimals),
          expectedProfit: simulatedProfit
        };

        // start refreshing status
        const txStatusInterval = setInterval(() => {
          if (cache.swappingRightNow) {
            dumpState(
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
            );
          }
        }, 500);
        window.txInterval = txStatusInterval;

        [tx, performanceOfTx] = await swap(jupiter, route);

        // stop refreshing status
        clearInterval(txStatusInterval);
        window.txInterval = null;

        const profit = calculateProfit(
          cache.currentBalance[cache.sideBuy ? 'tokenB' : 'tokenA'],
          tx.outputAmount
        );

        tradeEntry = {
          ...tradeEntry,
          outAmount: tx.outputAmount || 0,
          profit,
          performanceOfTx,
          error: tx.error?.message || null
        };

        // handle TX results
        if (tx.error) failedSwapHandler(tradeEntry);
        else {
          if (cache.hotkeys.r) {
            console.log('[R] - REVERT BACK SWAP - SUCCESS!');
            cache.tradingEnabled = false;
            console.log('TRADING DISABLED!');
            cache.hotkeys.r = false;
          }
          successSwapHandler(tx, tradeEntry, tokenA, tokenB);
        }
      }
    }

    if (tx) {
      if (!tx.error) {
        // change side
        cache.sideBuy = !cache.sideBuy;
      }
      cache.swappingRightNow = false;
    }

    dumpState(
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
    );
  } catch (error) {
    cache.queue[i] = 1;
    console.log(error);
  } finally {
    delete cache.queue[i];
  }
};

const arbitrageStrategy = async (jupiter, tokenA, callback) => {
  cache.iteration++;
  const date = new Date();
  const i = cache.iteration;
  cache.queue[i] = -1;
  try {
    // calculate & update iterations per minute
    updateIterationsPerMin(cache);

    // Calculate amount that will be used for trade
    const amountToTrade =
      cache.config.tradeSize.strategy === 'cumulative'
        ? cache.currentBalance['tokenA']
        : cache.initialBalance['tokenA'];
    const baseAmount = cache.lastBalance['tokenA'];

    // default slippage
    const slippage = typeof cache.config.slippage === 'number' ? cache.config.slippage : 1;
    // set input / output token
    const inputToken = tokenA;
    const outputToken = tokenA;

    // check current routes
    const performanceOfRouteCompStart = performance.now();
    const routes = await jupiter.computeRoutes({
      inputMint: new PublicKey(inputToken.address),
      outputMint: new PublicKey(outputToken.address),
      inputAmount: amountToTrade,
      slippage,
      forceFetch: true
    });

    checkRoutesResponse(routes);

    // count available routes
    cache.availableRoutes[cache.sideBuy ? 'buy' : 'sell'] = routes.routesInfos.length;

    // update status as OK
    cache.queue[i] = 0;

    const performanceOfRouteComp = performance.now() - performanceOfRouteCompStart;

    // choose first route
    const route = await routes.routesInfos[1];

    // update slippage with "profit or kill" slippage
    if (cache.config.slippage === 'profitOrKill') {
      route.outAmountWithSlippage = cache.lastBalance['tokenA'];
    }

    // calculate profitability
    let simulatedProfit = calculateProfit(baseAmount, await route.outAmount);

    // store max profit spotted
    if (simulatedProfit > cache.maxProfitSpotted['buy']) {
      cache.maxProfitSpotted['buy'] = simulatedProfit;
    }

    dumpState(
      {
        date,
        i,
        performanceOfRouteComp,
        inputToken,
        outputToken,
        tokenA,
        tokenB: tokenA,
        route,
        simulatedProfit
      },
      callback
    );

    // check profitability and execute tx
    let tx, performanceOfTx;
    if (
      !cache.swappingRightNow &&
      (cache.hotkeys.e || cache.hotkeys.r || simulatedProfit >= cache.config.minPercProfit)
    ) {
      // hotkeys
      if (cache.hotkeys.e) {
        console.log('[E] PRESSED - EXECUTION FORCED BY USER!');
        cache.hotkeys.e = false;
      }
      if (cache.hotkeys.r) {
        console.log('[R] PRESSED - REVERT BACK SWAP!');
        route.outAmountWithSlippage = 0;
      }

      if (cache.tradingEnabled || cache.hotkeys.r) {
        cache.swappingRightNow = true;
        // store trade to the history
        let tradeEntry = {
          date: date.toLocaleString(),
          buy: cache.sideBuy,
          inputToken: inputToken.symbol,
          outputToken: outputToken.symbol,
          inAmount: toDecimal(route.inAmount, inputToken.decimals),
          expectedOutAmount: toDecimal(route.outAmount, outputToken.decimals),
          expectedProfit: simulatedProfit
        };

        // start refreshing status
        const txStatusInterval = setInterval(() => {
          if (cache.swappingRightNow) {
            dumpState(
              {
                date,
                i,
                performanceOfRouteComp,
                inputToken,
                outputToken,
                tokenA,
                tokenB: tokenA,
                route,
                simulatedProfit
              },
              callback
            );
          }
        }, 500);
        window.txInterval = txStatusInterval;

        [tx, performanceOfTx] = await swap(jupiter, route);

        // stop refreshing status
        clearInterval(txStatusInterval);
        window.txInterval = null;

        const profit = calculateProfit(
          cache.currentBalance[cache.sideBuy ? 'tokenB' : 'tokenA'],
          tx.outputAmount
        );

        tradeEntry = {
          ...tradeEntry,
          outAmount: tx.outputAmount || 0,
          profit,
          performanceOfTx,
          error: tx.error?.message || null
        };

        // handle TX results
        if (tx.error) failedSwapHandler(tradeEntry);
        else {
          if (cache.hotkeys.r) {
            console.log('[R] - REVERT BACK SWAP - SUCCESS!');
            cache.tradingEnabled = false;
            console.log('TRADING DISABLED!');
            cache.hotkeys.r = false;
          }
          successSwapHandler(tx, tradeEntry, tokenA, tokenA);
        }
      }
    }

    if (tx) {
      cache.swappingRightNow = false;
    }

    dumpState(
      {
        date,
        i,
        performanceOfRouteComp,
        inputToken,
        outputToken,
        tokenA,
        tokenB: tokenA,
        route,
        simulatedProfit
      },
      callback
    );
  } catch (error) {
    cache.queue[i] = 1;
    throw error;
  } finally {
    delete cache.queue[i];
  }
};

const watcher = async (jupiter, tokenA, tokenB, callback) => {
  if (!cache.swappingRightNow && Object.keys(cache.queue).length < cache.queueThrottle) {
    if (cache.config.tradingStrategy === 'pingpong') {
      await pingpongStrategy(jupiter, tokenA, tokenB, callback);
    }
    if (cache.config.tradingStrategy === 'arbitrage') {
      await arbitrageStrategy(jupiter, tokenA, callback);
    }
  }
};

let jupiterInvocationToken = 0;

const runJupiter = async (config, callback) => {
  if (cache.running) {
    console.log('Jupiter is already running or being stopped!');
    return;
  }

  try {
    cache.reset();
    cache.running = true;
    cache.config = { ...defaultConfig, ...config };

    if (config.sideBuy !== undefined) {
      cache.sideBuy = config.sideBuy === true;
      delete cache.config.sideBuy;
    }

    const jupiterInvocationTokenLocal = ++jupiterInvocationToken;

    const { jupiter, tokenA, tokenB } = await setup();

    if (jupiterInvocationTokenLocal !== jupiterInvocationToken) {
      console.log('Jupiter was stopped!');
      return;
    }

    console.log('Starting Jupiter with the following config:', cache.config);

    if (cache.config.tradingStrategy === 'pingpong') {
      // set initial & current & last balance for tokenA
      cache.initialBalance.tokenA = toNumber(cache.config.tradeSize.value, tokenA.decimals);
      cache.currentBalance.tokenA = cache.initialBalance.tokenA;
      cache.lastBalance.tokenA = cache.initialBalance.tokenA;

      // set initial & last balance for tokenB
      cache.initialBalance.tokenB = await getInitialOutAmountWithSlippage(
        jupiter,
        tokenA,
        tokenB,
        cache.initialBalance.tokenA
      );
      cache.lastBalance.tokenB = cache.initialBalance.tokenB;
    } else if (cache.config.tradingStrategy === 'arbitrage') {
      // set initial & current & last balance for tokenA
      cache.initialBalance.tokenA = toNumber(cache.config.tradeSize.value, tokenA.decimals);
      cache.currentBalance.tokenA = cache.initialBalance.tokenA;
      cache.lastBalance.tokenA = cache.initialBalance.tokenA;
    }

    if (cache.isSetupDone)
      window.botInterval = setInterval(
        () => watcher(jupiter, tokenA, tokenB, callback),
        cache.config.minInterval
      );
  } catch (error) {
    logExit(error);
  }
};

const stopJupiter = async () => {
  if (window.txInterval) {
    clearInterval(window.txInterval);
    window.txInterval = null;
  }

  if (window.botInterval) {
    clearInterval(window.botInterval);
    window.botInterval = null;
  }

  cache.running = false;
  ++jupiterInvocationToken;

  console.log('Jupiter stopped!');
};

export { runJupiter, stopJupiter };

import { logExit } from './exit';

const calculateProfit = (oldVal, newVal) => ((newVal - oldVal) / oldVal) * 100;

const toDecimal = (number, decimals) =>
  parseFloat(number / 10 ** decimals).toFixed(decimals);

const toNumber = (number, decimals) => number * 10 ** decimals;

/**
 * It calculates the number of iterations per minute and updates the cache.
 */
const updateIterationsPerMin = (cache) => {
  const iterationTimer =
    (performance.now() - cache.iterationPerMinute.start) / 1000;

  if (iterationTimer >= 60) {
    cache.iterationPerMinute.value = Number(
      cache.iterationPerMinute.counter.toFixed()
    );
    cache.iterationPerMinute.start = performance.now();
    cache.iterationPerMinute.counter = 0;
  } else cache.iterationPerMinute.counter++;
};

const checkRoutesResponse = (routes) => {
  if (Object.hasOwn(routes, 'routesInfos')) {
    if (routes.routesInfos.length === 0) {
      logExit(1, {
        message: 'No routes found or something is wrong with RPC / Jupiter!',
      });
    }
  } else {
    logExit(1, {
      message: 'Something is wrong with RPC / Jupiter! ',
    });
  }
};

export {
  calculateProfit,
  toDecimal,
  toNumber,
  updateIterationsPerMin,
  checkRoutesResponse,
};

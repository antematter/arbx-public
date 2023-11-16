const cacheDefault = {
  startTime: new Date(),
  queue: {},
  queueThrottle: 1,
  sideBuy: true,
  iteration: 0,
  iterationPerMinute: {
    start: performance.now(),
    value: 0,
    counter: 0
  },
  initialBalance: {
    tokenA: 0,
    tokenB: 0
  },
  currentBalance: {
    tokenA: 0,
    tokenB: 0
  },
  currentProfit: {
    tokenA: 0,
    tokenB: 0
  },
  lastBalance: {
    tokenA: 0,
    tokenB: 0
  },
  profit: {
    tokenA: 0,
    tokenB: 0
  },
  maxProfitSpotted: {
    buy: 0,
    sell: 0
  },
  tradeCounter: {
    buy: { success: 0, fail: 0 },
    sell: { success: 0, fail: 0 }
  },
  chart: {
    spottedMax: {
      buy: new Array(120).fill(0),
      sell: new Array(120).fill(0)
    },
    performanceOfRouteComp: new Array(120).fill(0)
  },
  hotkeys: {
    e: false,
    r: false
  },
  tradingEnabled:
    process.env.REACT_APP_JUP_TRADING_ENABLED === undefined
      ? true
      : process.env.REACT_APP_JUP_TRADING_ENABLED === 'true',
  wrapUnwrapSOL:
    process.env.REACT_APP_JUP_WRAP_UNWRAP_SOL === undefined
      ? true
      : process.env.REACT_APP_JUP_WRAP_UNWRAP_SOL === 'true',
  swappingRightNow: false,
  fetchingResultsFromSolscan: false,
  fetchingResultsFromSolscanStart: 0,
  tradeHistory: [],
  performanceOfTxStart: 0,
  availableRoutes: {
    buy: 0,
    sell: 0
  },
  isSetupDone: false,
  running: false
};

// global cache
const cache = {
  ...cacheDefault,

  reset: function () {
    Object.assign(this, JSON.parse(JSON.stringify(cacheDefault)));
  }
};

export default cache;

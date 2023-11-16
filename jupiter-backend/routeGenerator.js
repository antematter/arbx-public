const JSBI = require("jsbi");
const Decimal = require("decimal.js");
const fetch = require("cross-fetch");
const web3 = require("@solana/web3.js");
const math = require("@jup-ag/math");
const utils = require("./utils");
const Amms = require("./amms");
const SwapMode = Amms.SwapMode;

function _interopDefaultLegacy(e) {
  return e && typeof e === "object" && "default" in e ? e : { default: e };
}

//Constants
const JSBI__default = _interopDefaultLegacy(JSBI);
const Decimal__default = _interopDefaultLegacy(Decimal);
const MAX_DIMENSIONS = 1e2;
const MAX_SIZE = 4294967296; // 2 ** 32 = 4,294,967,296
const PLATFORM_FEE_DENOMINATOR = JSBI__default["default"].BigInt(10000);
const cache = {};
const MAX_LEVEL = 2;

function getInputOutputId({ inputMint, outputMint }) {
  return `${inputMint}-${outputMint}`;
}

function getQuoteId({ ammId, amount }) {
  return `${ammId}-${amount.toString()}`;
}

function getQuoteAndSortBasedOnOutAmount({
  amms,
  inputMint,
  outputMint,
  amount,
  swapMode,
}) {
  const quotes = amms
    .map((amm) => {
      try {
        const quote = amm.getQuote({
          amount,
          sourceMint: new web3.PublicKey(inputMint),
          destinationMint: new web3.PublicKey(outputMint),
          swapMode,
        });
        return {
          quote,
          amm: amm,
        };
      } catch (e) {
        return undefined;
      }
    })
    .filter(Boolean)
    .sort((a, b) =>
      JSBI__default["default"].greaterThanOrEqual(
        (b === null || b === void 0 ? void 0 : b.quote.outAmount) || math.ZERO,
        (a === null || a === void 0 ? void 0 : a.quote.outAmount) || math.ZERO
      )
        ? 1
        : -1
    );
  return quotes;
} // Change this to support N-1 level of hops

const validateArray = function (array) {
  if (!Array.isArray(array)) {
    throw new TypeError(`Argument must be an array: ${array}`);
  }
};
const validateDimensions = function ({ length }) {
  if (length >= MAX_DIMENSIONS) {
    throw new TypeError(
      `Too many arrays (${length}): please use the 'big-cartesian' library instead of 'fast-cartesian'`
    );
  }
};

const multiplySize = function (size, array) {
  return size * array.length;
};

const validateCombinations = function (arrays) {
  const size = arrays.reduce(multiplySize, 1);

  if (size >= MAX_SIZE) {
    const sizeStr = Number.isFinite(size) ? ` (${size.toExponential(0)})` : "";
    throw new TypeError(
      `Too many combinations${sizeStr}: please use the 'big-cartesian' library instead of 'fast-cartesian'`
    );
  }
};

const validateInput = function (arrays) {
  if (!Array.isArray(arrays)) {
    throw new TypeError("Argument must be an array of arrays");
  }

  arrays.forEach(validateArray);
  validateDimensions(arrays);
  validateCombinations(arrays);
};

const getIndex = function (value, index) {
  return String(index);
};

const mGetLoopFunc = function (length) {
  const indexes = Array.from(
    {
      length,
    },
    getIndex
  );
  const start = indexes
    .map((index) => `for (const value${index} of arrays[${index}]) {`)
    .join("\n");
  const middle = indexes.map((index) => `value${index}`).join(", ");
  const end = "}\n".repeat(length); // eslint-disable-next-line no-new-func

  return new Function(
    "arrays",
    "result",
    `${start}\nresult.push([${middle}])\n${end}`
  );
};

const getLoopFunc = function (length) {
  const cachedLoopFunc = cache[length];

  if (cachedLoopFunc !== undefined) {
    return cachedLoopFunc;
  }

  const loopFunc = mGetLoopFunc(length); // eslint-disable-next-line fp/no-mutation

  cache[length] = loopFunc;
  return loopFunc;
};

function fastCartesian(arrays) {
  validateInput(arrays);

  if (arrays.length === 0) {
    return [];
  }

  const loopFunc = getLoopFunc(arrays.length);
  const result = [];
  loopFunc(arrays, result);
  return result;
}

const isValidRoute = (ammA, ammB) => {
  // dont match the same amm together
  if (ammA.id === ammB.id) {
    return false;
  } // don't show decimal as input or output
  else if (
    ammA instanceof Amms.SaberAddDecimalsAmm &&
    ammB instanceof Amms.SaberAddDecimalsAmm
  ) {
    return false;
  }
  // } else if (ammA instanceof SplitTradeAmm || ammB instanceof SplitTradeAmm) {
  //   return false;
  // }

  return true;
};


function ammCrossProtocolPairs(arr, callback) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      // Don't pair amm with same label
      if (arr[i].label !== arr[j].label) {
        callback(arr[i], arr[j]);
      }
    }
  }
}

function processInputRouteSegmentToRoutesInfos(
  inputRouteSegment,
  inputMint,
  outputMint,
  amount,
  getDepositAndFeeForRoute,
  platformFeeBps,
  slippage,
  onlyDirectRoutes,
  swapMode,
  connection,
  feeCalculator,
  user,
  serumOpenOrdersPromise,
  filterTopNResult = 3
) {
  const inputMintString = inputMint.toBase58();
  const outputMintString = outputMint.toBase58(); // (InputMint-OutputMint) map to (AmmId-InputAmount) map to Quote from the amm with the inputAmount
  // this is used to prevent calculation being repeated later on.

  const tradeIdQuoteMap = new Map();
  const inputMintInnerMap = inputRouteSegment.get(inputMintString);
  // console.log(`Input Mint Inner Map: ${JSON.stringify(inputMintInnerMap)}`);
  const routes = [];

  if (!inputMintInnerMap) {
    throw new Error("No routes found for the input and output mints");
  }

  const maxLevel = onlyDirectRoutes ? 0 : MAX_LEVEL;
  /*
   * It get the rate of all single pair that is linked to the inputMint
   * Example: SOL => USDC, will have direct pair, while
   *          SOL => USDT, USDT => SOL will have a hop
   *
   * So we go through each of the hop and get the top 3 rate and drop others
   * This will eventually reduce the needs to compute bad rate for the same pair
   *
   * The loop below is doing for the inputMint, while the one after is doing for the outputMint.
   */

  const walkTheTree = ({ inputMint, level = 0, walked = [inputMint] }) => {
    const inputMintInnerMap = inputRouteSegment.get(inputMint);

    // console.log(`Walk Tree InputMintInnerMap: ${[...inputMintInnerMap]}`);
    if (inputMintInnerMap) {
      inputMintInnerMap.forEach((amms, outMint) => {
        // console.log(`amms: ${JSON.stringify(amms)}: outMint: ${outMint}`);
        const tradeId = getInputOutputId({
          inputMint,
          outputMint: outMint,
        });
        const sortedQuotesWithAmms = getQuoteAndSortBasedOnOutAmount({
          amms,
          inputMint,
          outputMint: outMint,
          amount,
          swapMode,
        });
        const { filteredAmms, quoteMap } = sortedQuotesWithAmms.reduce(
          (result, item, idx) => {
            if (idx < filterTopNResult) {
              result.filteredAmms.push(item.amm);
            }

            result.quoteMap.set(
              getQuoteId({
                ammId: item.amm.id,
                amount,
              }),
              item.quote
            );
            return result;
          },
          {
            filteredAmms: [],
            quoteMap: new Map(),
          }
        );
        const splitTradeAmms = []; // add split trade in when outputMint match and it's not direct only routes

        if (outMint === outputMintString && !onlyDirectRoutes) {
          ammCrossProtocolPairs(filteredAmms.slice(), (firstAmm, secondAmm) => {
            const splitTradeAmm = SplitTradeAmm.create(firstAmm, secondAmm);

            if (splitTradeAmm) {
              splitTradeAmms.push(splitTradeAmm);
            }
          });
        }

        inputMintInnerMap.set(outMint, filteredAmms.concat(splitTradeAmms));
        tradeIdQuoteMap.set(tradeId, quoteMap); // keep looping if not walked and not reached max level

        if (
          outMint !== outputMintString &&
          quoteMap.size &&
          !walked.includes(outMint) &&
          level < maxLevel - 1
        ) {
          walkTheTree({
            inputMint: outMint,
            amount: quoteMap.values().next().value.outAmount,
            level: level + 1,
            walked: walked.concat(outMint),
          });
        } else if (outMint === outputMintString) {
          if (level === 0) {
            // we need to add the direct routes as it is computed instead of using filteredAmms
            inputMintInnerMap.set(
              outMint,
              sortedQuotesWithAmms
                .map((item) => item.amm)
                .concat(splitTradeAmms)
            );
          } // if output reached, we add the route

          const mints = walked.concat(outMint);

          const _mints = mints.map((i) => new web3.PublicKey(i));

          const ammsArr = mints.reduce((amms, _, index) => {
            if (index < mints.length - 1) {
              var _inputRouteSegment$ge;

              amms.push(
                (_inputRouteSegment$ge = inputRouteSegment.get(
                  mints[index]
                )) === null || _inputRouteSegment$ge === void 0
                  ? void 0
                  : _inputRouteSegment$ge.get(mints[index + 1])
              );
            }

            return amms;
          }, []);
          const permutations = fastCartesian(ammsArr);
          permutations.forEach((item) => {
            if (item.length === 1 || isValidRoute(item[0], item[1])) {
              routes.push({
                amms: item,
                mints: _mints,
              });
            }
          });
        }
      });
    }
  };

  console.time("walkTheTree");
  walkTheTree({
    inputMint: inputMintString,
    amount,
  });
  console.timeEnd("walkTheTree");
  const routesInfo = routes
    .map((route) => {
      const { amms, mints } = route; // Chain all amms

      let marketInfos = [];
      let intermediateAmount = amount;
      let otherAmountThreshold = math.ZERO;
      const platformFeeSupported = utils.isPlatformFeeSupported(swapMode, amms);
      const tokenMints = mints;
      const legs = amms.length;

      for (const [i, amm] of amms.entries()) {
        try {
          var _tradeIdQuoteMap$get;

          const sourceMint = tokenMints[i];
          const destinationMint = tokenMints[i + 1];
          const tradeId = getInputOutputId({
            inputMint: sourceMint.toBase58(),
            outputMint: destinationMint.toBase58(),
          });
          const cacheQuote =
            (_tradeIdQuoteMap$get = tradeIdQuoteMap.get(tradeId)) === null ||
            _tradeIdQuoteMap$get === void 0
              ? void 0
              : _tradeIdQuoteMap$get.get(
                  getQuoteId({
                    ammId: amm.id,
                    amount: intermediateAmount,
                  })
                );
          const quote =
            cacheQuote ||
            amm.getQuote({
              sourceMint,
              destinationMint,
              amount: intermediateAmount,
              swapMode,
            }); // Platform fee applicable only on last leg
          const isLastLeg = legs - 1 === i;
          const platformFee =
            isLastLeg && platformFeeSupported
              ? {
                  amount: JSBI__default["default"].divide(
                    JSBI__default["default"].multiply(
                      quote.outAmount,
                      JSBI__default["default"].BigInt(platformFeeBps)
                    ),
                    PLATFORM_FEE_DENOMINATOR
                  ),
                  mint: destinationMint.toBase58(),
                  pct: platformFeeBps / 100,
                }
              : {
                  amount: math.ZERO,
                  mint: destinationMint.toBase58(),
                  pct: 0,
                };
          const amountForFees =
            swapMode === SwapMode.ExactIn ? quote.outAmount : quote.inAmount;

          let amountAfterFees =
            swapMode === SwapMode.ExactIn
              ? JSBI__default["default"].subtract(
                  amountForFees,
                  platformFee.amount
                )
              : JSBI__default["default"].add(amountForFees, platformFee.amount);

          if (JSBI__default["default"].lessThan(amountAfterFees, math.ZERO)) {
            amountAfterFees = math.ZERO;
          }

          const legOtherAmountThreshold = JSBI__default["default"].BigInt(
            swapMode === SwapMode.ExactIn
              ? new Decimal__default["default"](amountAfterFees.toString())
                  .mul(1 - slippage / 100)
                  .ceil()
              : new Decimal__default["default"](amountAfterFees.toString())
                  .mul(1 + slippage / 100)
                  .floor()
          );
          const [inAmount, outAmount] =
            swapMode === SwapMode.ExactIn
              ? [quote.inAmount, amountAfterFees]
              : [amountAfterFees, intermediateAmount];
          marketInfos.push({
            amm,
            inputMint: sourceMint,
            outputMint: destinationMint,
            notEnoughLiquidity: quote.notEnoughLiquidity,
            minInAmount: quote.minInAmount,
            minOutAmount: quote.minOutAmount,
            inAmount,
            outAmount,
            priceImpactPct: quote.priceImpactPct,
            lpFee: {
              amount: quote.feeAmount,
              mint: quote.feeMint,
              pct: quote.feePct,
            },
            platformFee,
          });
          intermediateAmount =
            swapMode === SwapMode.ExactIn ? amountAfterFees : amount;
          otherAmountThreshold = legOtherAmountThreshold;
        } catch (e) {
          return undefined;
        }
      }

      return {
        marketInfos,
        getDepositAndFee: () =>
          getDepositAndFeeForRoute(
            connection,
            feeCalculator,
            marketInfos,
            user,
            serumOpenOrdersPromise
          ),
        inAmount: marketInfos[0].inAmount,
        outAmount: intermediateAmount,
        amount,
        otherAmountThreshold,
        swapMode,
        priceImpactPct:
          1 -
          marketInfos.reduce((priceFactor, marketInfo) => {
            priceFactor *= 1 - marketInfo.priceImpactPct;
            return priceFactor;
          }, 1),
      };
    })
    .filter((item) => item !== undefined)
    .sort((a, b) =>
      JSBI__default["default"].greaterThanOrEqual(b.outAmount, a.outAmount)
        ? 1
        : -1
    ); // sort based on which one have better output

  return routesInfo;
}

module.exports = {
  processInputRouteSegmentToRoutesInfos,
};

const math = require("@jup-ag/math");
const Decimal = require("decimal.js");
const JSBI = require("jsbi");
const BN = require("bn.js");

const {
  STABLE_MARKET_ADDRESSES,
  TAKER_FEE_PCT,
  STABLE_TAKER_FEE_PCT,
} = require("./constants");

function _interopDefaultLegacy(e) {
  return e && typeof e === "object" && "default" in e ? e : { default: e };
}

const BN__default = _interopDefaultLegacy(BN);
const JSBI__default = _interopDefaultLegacy(JSBI);
const Decimal__default = _interopDefaultLegacy(Decimal);

const mapAddressToAccountInfos = (accountInfoMap, addresses) => {
  const accountInfos = addresses.map((address) => {
    const accountInfo = accountInfoMap.get(address.toString());

    if (!accountInfo) {
      throw new Error(`Account info ${address.toBase58()} missing`);
    }

    return accountInfo;
  });
  return accountInfos;
};

function divideBnToDecimal(numerator, denominator) {
  const quotient = new Decimal__default["default"](
    numerator.div(denominator).toString()
  );
  const rem = numerator.umod(denominator);
  const gcd = rem.gcd(denominator);
  return quotient.add(
    new Decimal__default["default"](rem.div(gcd).toString()).div(
      new Decimal__default["default"](denominator.div(gcd).toString())
    )
  );
}

function priceLotsToDecimal(market, price) {
  // @ts-expect-error _decoded
  const baseLotSize = market._decoded.baseLotSize;
  if (baseLotSize.isZero()) return new Decimal__default["default"](0);
  return divideBnToDecimal(
    // @ts-expect-error _decoded _baseSplTokenMultiplier is private
    price.mul(market._decoded.quoteLotSize).mul(market._baseSplTokenMultiplier), // @ts-expect-error _quoteSplTokenMultiplier is private
    baseLotSize.mul(market._quoteSplTokenMultiplier)
  );
}

function* getL2(orderbook) {
  const descending = orderbook.isBids;

  for (const { key, quantity } of orderbook.slab.items(descending)) {
    const price = JSBI__default["default"].BigInt(key.ushrn(64).toString());
    yield [price, JSBI__default["default"].BigInt(quantity.toString())];
  }
}

function forecastBuy(market, orderbook, pcIn, takerFeePct) {
  let coinOut = math.ZERO;
  let bestPrice = math.ZERO;
  let worstPrice = math.ZERO; // total base price

  let totalCost = math.ZERO;
  let totalCoins = math.ZERO; // might be decimal, e.g: 0.001

  const quoteSizeLots = market.quoteSizeLotsToNumber(
    new BN__default["default"](1)
  ); // Serum buy order take fee in quote tokens

  let availablePc = quoteSizeLots
    ? JSBI__default["default"].BigInt(
        new Decimal__default["default"](pcIn.toString())
          .div(1 + takerFeePct)
          .div(quoteSizeLots)
          .floor()
      )
    : math.ZERO;
  const baseSizeLots = JSBI__default["default"].BigInt(
    market.baseSizeLotsToNumber(new BN__default["default"](1)).toString()
  );

  for (let [lotPrice, lotQuantity] of getL2(orderbook)) {
    if (JSBI__default["default"].equal(bestPrice, math.ZERO)) {
      bestPrice = lotPrice;
    }

    worstPrice = lotPrice;
    const orderCoinAmount = JSBI__default["default"].multiply(
      lotQuantity,
      baseSizeLots
    );
    const orderPcAmount = JSBI__default["default"].multiply(
      lotQuantity,
      lotPrice
    );
    totalCoins = JSBI__default["default"].add(totalCoins, orderCoinAmount);

    if (
      JSBI__default["default"].greaterThanOrEqual(orderPcAmount, availablePc)
    ) {
      const numberLotsPurchasable = JSBI__default["default"].divide(
        availablePc,
        lotPrice
      );
      totalCost = JSBI__default["default"].add(
        totalCost,
        JSBI__default["default"].multiply(lotPrice, numberLotsPurchasable)
      );
      coinOut = JSBI__default["default"].add(
        coinOut,
        JSBI__default["default"].multiply(baseSizeLots, numberLotsPurchasable)
      );
      availablePc = math.ZERO;
      break;
    } else {
      totalCost = JSBI__default["default"].add(
        totalCost,
        JSBI__default["default"].multiply(lotPrice, lotQuantity)
      );
      coinOut = JSBI__default["default"].add(coinOut, orderCoinAmount);
      availablePc = JSBI__default["default"].subtract(
        availablePc,
        orderPcAmount
      );
    }
  }

  const bestPriceDecimal = new Decimal__default["default"](
    bestPrice.toString()
  );
  const worstPriceDecimal = new Decimal__default["default"](
    worstPrice.toString()
  );
  const priceImpactPct = worstPriceDecimal
    .sub(bestPriceDecimal)
    .div(bestPriceDecimal)
    .toNumber();
  const bestPriceSizeLots = priceLotsToDecimal(
    market,
    new BN__default["default"](bestPrice.toString())
  );
  const totalCostSizeLots = priceLotsToDecimal(
    market,
    new BN__default["default"](totalCost.toString())
  );
  const inAmountWithoutFee = totalCostSizeLots.mul(baseSizeLots.toString());
  const fee = totalCostSizeLots
    .mul(baseSizeLots.toString())
    .mul(takerFeePct)
    .ceil();
  return {
    side: "buy",
    notEnoughLiquidity: JSBI__default["default"].lessThanOrEqual(
      totalCoins,
      coinOut
    ),
    minimum: {
      in: JSBI__default["default"].BigInt(
        bestPriceSizeLots
          .mul(baseSizeLots.toString())
          .mul(1 + takerFeePct)
          .ceil()
      ),
      out: baseSizeLots,
    },
    inAmount: JSBI__default["default"].BigInt(inAmountWithoutFee.add(fee)),
    outAmount: coinOut,
    feeAmount: JSBI__default["default"].BigInt(fee),
    priceImpactPct,
    feePct: takerFeePct,
  };
}

function forecastSell(market, orderbook, coinIn, takerFeePct) {
  let pcOut = JSBI__default["default"].BigInt(0);
  let bestPrice = JSBI__default["default"].BigInt(0);
  let worstPrice = JSBI__default["default"].BigInt(0);
  let totalCoin = JSBI__default["default"].BigInt(0);
  let availableCoin = coinIn;
  let inAmount = JSBI__default["default"].BigInt(0);
  const baseSizeLots = JSBI__default["default"].BigInt(
    market.baseSizeLotsToNumber(new BN__default["default"](1))
  );
  const quoteSizeLots = JSBI__default["default"].BigInt(
    market.quoteSizeLotsToNumber(new BN__default["default"](1))
  );

  for (const [lotPrice, lotQuantity] of getL2(orderbook)) {
    if (JSBI__default["default"].equal(bestPrice, math.ZERO)) {
      bestPrice = lotPrice;
    }

    worstPrice = lotPrice;
    const orderCoinAmount = JSBI__default["default"].multiply(
      baseSizeLots,
      lotQuantity
    );
    const orderPcAmount = JSBI__default["default"].multiply(
      lotQuantity,
      JSBI__default["default"].multiply(lotPrice, quoteSizeLots)
    );
    totalCoin = JSBI__default["default"].add(totalCoin, orderCoinAmount);

    if (
      JSBI__default["default"].greaterThanOrEqual(
        orderCoinAmount,
        availableCoin
      )
    ) {
      const numberLotsCanSell = JSBI__default["default"].divide(
        availableCoin,
        baseSizeLots
      );
      const totalCoinAmountToSell = JSBI__default["default"].multiply(
        numberLotsCanSell,
        lotPrice
      );
      pcOut = JSBI__default["default"].add(
        pcOut,
        JSBI__default["default"].multiply(totalCoinAmountToSell, quoteSizeLots)
      );
      availableCoin = JSBI__default["default"].subtract(
        availableCoin,
        totalCoinAmountToSell
      );
      inAmount = JSBI__default["default"].add(
        inAmount,
        JSBI__default["default"].multiply(numberLotsCanSell, baseSizeLots)
      );
      break;
    } else {
      pcOut = JSBI__default["default"].add(pcOut, orderPcAmount);
      availableCoin = JSBI__default["default"].subtract(
        availableCoin,
        orderCoinAmount
      );
      inAmount = JSBI__default["default"].add(inAmount, orderCoinAmount);
    }
  }

  let pcOutAfterFee = new Decimal__default["default"](pcOut.toString())
    .mul(1 - takerFeePct)
    .floor();
  const bestPriceDecimal = priceLotsToDecimal(
    market,
    new BN__default["default"](bestPrice.toString())
  );
  const worstPriceDecimal = priceLotsToDecimal(
    market,
    new BN__default["default"](worstPrice.toString())
  );
  const priceImpactPct = bestPriceDecimal
    .minus(worstPriceDecimal)
    .div(bestPriceDecimal)
    .toNumber();
  return {
    side: "sell",
    notEnoughLiquidity: JSBI__default["default"].greaterThan(
      JSBI__default["default"].BigInt(coinIn),
      totalCoin
    ),
    minimum: {
      in: baseSizeLots,
      out: JSBI__default["default"].BigInt(
        bestPriceDecimal
          .mul(JSBI__default["default"].toNumber(baseSizeLots))
          .mul(1 - takerFeePct)
          .floor()
          .toString()
      ),
    },
    inAmount: inAmount,
    outAmount: JSBI__default["default"].BigInt(pcOutAfterFee),
    feeAmount: JSBI__default["default"].BigInt(
      new Decimal__default["default"](pcOut.toString()).mul(takerFeePct).round()
    ),
    priceImpactPct,
    feePct: takerFeePct,
  };
}

function getOutAmountMeta({
  market,
  asks,
  bids,
  fromAmount,
  fromMint,
  toMint,
}) {
  const takerFeePct = STABLE_MARKET_ADDRESSES.includes(
    market.address.toBase58()
  )
    ? STABLE_TAKER_FEE_PCT
    : TAKER_FEE_PCT;

  if (
    fromMint.equals(market.quoteMintAddress) &&
    toMint.equals(market.baseMintAddress)
  ) {
    // buy
    return forecastBuy(market, asks, fromAmount, takerFeePct);
  } else {
    return forecastSell(market, bids, fromAmount, takerFeePct);
  }
}

function prepareRemainingAccounts(inAmount, tokenLedger, feeAccount) {
  const remainingAccounts = [];

  if (inAmount === null) {
    remainingAccounts.push({
      pubkey: tokenLedger,
      isSigner: false,
      isWritable: true,
    });
  }

  if (feeAccount) {
    remainingAccounts.push({
      pubkey: feeAccount,
      isSigner: false,
      isWritable: true,
    });
  }

  return remainingAccounts;
}

const tokenAccountsToJSBIs = (tokenAccounts) => {
  return tokenAccounts.map((tokenAccount) => {
    return JSBI__default["default"].BigInt(tokenAccount.amount);
  });
};

const SwapMode = {
  ExactIn: "ExactIn",
  ExactOut: "ExactOut",
};

module.exports = {
  mapAddressToAccountInfos,
  divideBnToDecimal,
  priceLotsToDecimal,
  getL2,
  forecastBuy,
  forecastSell,
  getOutAmountMeta,
  prepareRemainingAccounts,
  tokenAccountsToJSBIs,
  BN__default,
  JSBI__default,
  Decimal__default,
  SwapMode,
};

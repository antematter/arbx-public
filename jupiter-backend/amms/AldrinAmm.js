const splToken = require("@solana/spl-token");
const math = require("@jup-ag/math");
const optimist = require("@mercurial-finance/optimist");

const { JUPITER_PROGRAM } = require("../jupiter");
const { ALDRIN_SWAP_V2_PROGRAM_ID,ALDRIN_SWAP_PROGRAM_ID } = require("./constants");
const { POOL_V2_LAYOUT, POOL_LAYOUT,STABLE_CURVE_LAYOUT } = require("./layouts");
const {
  prepareRemainingAccounts,
  mapAddressToAccountInfos,
  tokenAccountsToJSBIs,
  JSBI__default,
  Decimal__default,
} = require("./utils");

const Side = {
  Bid: {
    bid: {},
  },
  Ask: {
    ask: {},
  },
};

const ZERO = new splToken.u64(0);

class Percentage {
  constructor(numerator, denominator) {
    this.numerator = void 0;
    this.denominator = void 0;

    this.toString = () => {
      return `${this.numerator.toString()}/${this.denominator.toString()}`;
    };

    this.numerator = numerator;
    this.denominator = denominator;
  }

  static fromDecimal(number) {
    return Percentage.fromFraction(
      number.toDecimalPlaces(1).mul(10).toNumber(),
      1000
    );
  }

  static fromFraction(numerator, denominator) {
    const num =
      typeof numerator === "number"
        ? new splToken.u64(numerator.toString())
        : numerator;
    const denom =
      typeof denominator === "number"
        ? new splToken.u64(denominator.toString())
        : denominator;
    return new Percentage(num, denom);
  }

  toDecimal() {
    if (this.denominator.eq(ZERO)) {
      return new Decimal__default["default"](0);
    }

    return new Decimal__default["default"](this.numerator.toString()).div(
      new Decimal__default["default"](this.denominator.toString())
    );
  }

  add(p2) {
    const denomGcd = this.denominator.gcd(p2.denominator);
    const denomLcm = this.denominator.div(denomGcd).mul(p2.denominator);
    const p1DenomAdjustment = denomLcm.div(this.denominator);
    const p2DenomAdjustment = denomLcm.div(p2.denominator);
    const p1NumeratorAdjusted = this.numerator.mul(p1DenomAdjustment);
    const p2NumeratorAdjusted = p2.numerator.mul(p2DenomAdjustment);
    const newNumerator = p1NumeratorAdjusted.add(p2NumeratorAdjusted);
    return new Percentage(
      new splToken.u64(newNumerator.toString()),
      new splToken.u64(denomLcm.toString())
    );
  }
}

function accountInfoToAldrinPoolState(address, accountInfo) {
  const isV2 = accountInfo.owner.equals(ALDRIN_SWAP_V2_PROGRAM_ID)
    ? true
    : false;
  const decoded = (isV2 ? POOL_V2_LAYOUT : POOL_LAYOUT).decode(
    accountInfo.data
  );
  const curveObject =
    "curveType" in decoded
      ? {
          curveType: decoded.curveType,
          curve: decoded.curve,
        }
      : {};
  return {
    isV2,
    address,
    poolMint: decoded.poolMint,
    baseTokenVault: decoded.baseTokenVault,
    baseTokenMint: decoded.baseTokenMint,
    quoteTokenVault: decoded.quoteTokenVault,
    quoteTokenMint: decoded.quoteTokenMint,
    poolSigner: decoded.poolSigner,
    feeBaseAccount: decoded.feeBaseAccount,
    feeQuoteAccount: decoded.feeQuoteAccount,
    feePoolTokenAccount: decoded.feePoolTokenAccount,
    fees: {
      traderFee: Percentage.fromFraction(
        decoded.fees.tradeFeeNumerator,
        decoded.fees.tradeFeeDenominator
      ),
      ownerFee: Percentage.fromFraction(
        decoded.fees.ownerTradeFeeNumerator,
        decoded.fees.ownerTradeFeeDenominator
      ),
    },
    ...curveObject,
  };
}

function createAldrinV2SwapInstruction({
  poolState,
  sourceMint,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  curve,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps8;

  const [side, userBaseTokenAccount, userQuoteTokenAccount] = sourceMint.equals(
    poolState.baseTokenMint
  )
    ? [Side.Ask, userSourceTokenAccount, userDestinationTokenAccount]
    : [Side.Bid, userDestinationTokenAccount, userSourceTokenAccount];
  return JUPITER_PROGRAM.instruction.aldrinV2Swap(
    inAmount,
    minimumOutAmount,
    side,
    (_platformFee$feeBps8 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps8 !== void 0
      ? _platformFee$feeBps8
      : 0,
    {
      accounts: {
        swapProgram: ALDRIN_SWAP_V2_PROGRAM_ID,
        pool: poolState.address,
        poolSigner: poolState.poolSigner,
        poolMint: poolState.poolMint,
        baseTokenVault: poolState.baseTokenVault,
        quoteTokenVault: poolState.quoteTokenVault,
        feePoolTokenAccount: poolState.feePoolTokenAccount,
        walletAuthority: userTransferAuthority,
        userBaseTokenAccount,
        userQuoteTokenAccount,
        curve,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
      },
      remainingAccounts: prepareRemainingAccounts(
        inAmount,
        tokenLedger,
        platformFee === null || platformFee === void 0
          ? void 0
          : platformFee.feeAccount
      ),
    }
  );
}

function createAldrinSwapInstruction({
  poolState,
  sourceMint,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps7;

  const [side, userBaseTokenAccount, userQuoteTokenAccount] = sourceMint.equals(
    poolState.baseTokenMint
  )
    ? [Side.Ask, userSourceTokenAccount, userDestinationTokenAccount]
    : [Side.Bid, userDestinationTokenAccount, userSourceTokenAccount];
  return JUPITER_PROGRAM.instruction.aldrinSwap(
    inAmount,
    minimumOutAmount,
    side,
    (_platformFee$feeBps7 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps7 !== void 0
      ? _platformFee$feeBps7
      : 0,
    {
      accounts: {
        swapProgram: ALDRIN_SWAP_PROGRAM_ID,
        pool: poolState.address,
        poolSigner: poolState.poolSigner,
        poolMint: poolState.poolMint,
        baseTokenVault: poolState.baseTokenVault,
        quoteTokenVault: poolState.quoteTokenVault,
        feePoolTokenAccount: poolState.feePoolTokenAccount,
        walletAuthority: userTransferAuthority,
        userBaseTokenAccount,
        userQuoteTokenAccount,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
      },
      remainingAccounts: prepareRemainingAccounts(
        inAmount,
        tokenLedger,
        platformFee === null || platformFee === void 0
          ? void 0
          : platformFee.feeAccount
      ),
    }
  );
}

class AldrinAmm {
  constructor(address, accountInfo, params) {
    this.params = void 0;
    this.id = void 0;
    this.label = "Aldrin";
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this.poolState = void 0;
    this.tokenAccounts = [];
    this.calculator = void 0;
    this.params = params;
    this.poolState = accountInfoToAldrinPoolState(address, accountInfo);
    this.id = address.toBase58();

    if (this.poolState.curveType === 1) {
      const { amp } = this.params;

      if (!amp) {
        throw new Error("Amp is required for a stable curve");
      }

      this.calculator = new math.TokenSwapStable(
        JSBI__default["default"].BigInt(amp),
        new math.Fraction(
          JSBI__default["default"].BigInt(
            this.poolState.fees.traderFee.numerator.toString()
          ),
          JSBI__default["default"].BigInt(
            this.poolState.fees.traderFee.denominator.toString()
          )
        ),
        new math.Fraction(
          JSBI__default["default"].BigInt(
            this.poolState.fees.ownerFee.numerator.toString()
          ),
          JSBI__default["default"].BigInt(
            this.poolState.fees.ownerFee.denominator.toString()
          )
        )
      );
    } else {
      this.calculator = new math.TokenSwapConstantProduct(
        new math.Fraction(
          JSBI__default["default"].BigInt(
            this.poolState.fees.traderFee.numerator.toString()
          ),
          JSBI__default["default"].BigInt(
            this.poolState.fees.traderFee.denominator.toString()
          )
        ),
        new math.Fraction(
          JSBI__default["default"].BigInt(
            this.poolState.fees.ownerFee.numerator.toString()
          ),
          JSBI__default["default"].BigInt(
            this.poolState.fees.ownerFee.denominator.toString()
          )
        )
      );
    }
  }

  static decodeStableCurveAmp(accountInfo) {
    const { amp } = STABLE_CURVE_LAYOUT.decode(accountInfo.data);
    return amp.toNumber() * 2; // times two for their AMP, dont ask me why, it is what it is
  }

  getAccountsForUpdate() {
    return [this.poolState.quoteTokenVault, this.poolState.baseTokenVault];
  }

  update(accountInfoMap) {
    const tokenAccountInfos = mapAddressToAccountInfos(
      accountInfoMap,
      this.getAccountsForUpdate()
    );
    this.tokenAccounts = tokenAccountInfos.map((info) => {
      const tokenAccount = optimist.deserializeAccount(info.data);
      if (!tokenAccount) throw new Error("Invalid token account");
      return tokenAccount;
    });
  }

  getQuote({ sourceMint, amount }) {
    if (this.tokenAccounts.length === 0) {
      throw new Error("Unable to fetch accounts for specified tokens.");
    }

    let feePct = new Decimal__default["default"](
      this.poolState.fees.traderFee.numerator.toString()
    )
      .div(this.poolState.fees.traderFee.denominator.toString())
      .add(
        new Decimal__default["default"](
          this.poolState.fees.ownerFee.numerator.toString()
        ).div(this.poolState.fees.ownerFee.denominator.toString())
      );
    const outputIndex = this.tokenAccounts[0].mint.equals(sourceMint) ? 1 : 0;
    let result = this.calculator.exchange(
      tokenAccountsToJSBIs(this.tokenAccounts),
      amount,
      outputIndex
    );
    return {
      notEnoughLiquidity: false,
      inAmount: amount,
      outAmount: result.expectedOutputAmount,
      feeAmount: result.fees,
      feeMint: sourceMint.toBase58(),
      feePct: feePct.toNumber(),
      priceImpactPct: result.priceImpact.toNumber(),
    };
  }

  createSwapInstructions(swapParams) {
    if (this.poolState.isV2) {
      if (!this.poolState.curve) {
        throw new Error("Unable to fetch curve account.");
      }

      const curve = this.poolState.curve;
      return [
        createAldrinV2SwapInstruction({
          poolState: this.poolState,
          curve,
          ...swapParams,
          inAmount: swapParams.amount,
          minimumOutAmount: swapParams.otherAmountThreshold,
        }),
      ];
    }

    return [
      createAldrinSwapInstruction({
        poolState: this.poolState,
        ...swapParams,
        inAmount: swapParams.amount,
        minimumOutAmount: swapParams.otherAmountThreshold,
      }),
    ];
  }

  get reserveTokenMints() {
    return [this.poolState.baseTokenMint, this.poolState.quoteTokenMint];
  }
}
AldrinAmm.accountInfoToAldrinPoolState = accountInfoToAldrinPoolState;

module.exports = {
  AldrinAmm,
};

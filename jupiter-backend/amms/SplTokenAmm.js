const splToken = require("@solana/spl-token");
const math = require("@jup-ag/math");
const optimist = require("@mercurial-finance/optimist");
const web3 = require("@solana/web3.js");

const { JUPITER_PROGRAM } = require("../jupiter");
const { STEP_TOKEN_SWAP_PROGRAM_ID } = require("./constants");
const { StepTokenSwapLayout, TokenSwapLayout } = require("./layouts");
const {
  prepareRemainingAccounts,
  mapAddressToAccountInfos,
  tokenAccountsToJSBIs,
  JSBI__default,
  Decimal__default,
} = require("./utils");

function accountInfoToTokenSwapState(address, tokenSwapAccountInfo) {
  const programId = tokenSwapAccountInfo.owner; // The layout difference only affects fields we do not actively use

  const tokenSwapData = programId.equals(STEP_TOKEN_SWAP_PROGRAM_ID)
    ? StepTokenSwapLayout.decode(tokenSwapAccountInfo.data)
    : TokenSwapLayout.decode(tokenSwapAccountInfo.data);

  if (!tokenSwapData.isInitialized) {
    throw new Error(`Invalid token swap state`);
  }

  const [authority] = web3.PublicKey.findProgramAddressSync(
    [address.toBuffer()],
    programId
  );
  const poolToken = new web3.PublicKey(tokenSwapData.tokenPool);
  const feeAccount = new web3.PublicKey(tokenSwapData.feeAccount);
  const tokenAccountA = new web3.PublicKey(tokenSwapData.tokenAccountA);
  const tokenAccountB = new web3.PublicKey(tokenSwapData.tokenAccountB);
  const mintA = new web3.PublicKey(tokenSwapData.mintA);
  const mintB = new web3.PublicKey(tokenSwapData.mintB);
  const tokenProgramId = new web3.PublicKey(tokenSwapData.tokenProgramId);
  const tradeFeeNumerator = tokenSwapData.tradeFeeNumerator;
  const tradeFeeDenominator = tokenSwapData.tradeFeeDenominator;
  const ownerTradeFeeNumerator = tokenSwapData.ownerTradeFeeNumerator;
  const ownerTradeFeeDenominator = tokenSwapData.ownerTradeFeeDenominator;
  const ownerWithdrawFeeNumerator = tokenSwapData.ownerWithdrawFeeNumerator;
  const ownerWithdrawFeeDenominator = tokenSwapData.ownerWithdrawFeeDenominator;
  const curveType = tokenSwapData.curveType;
  const curveParameters = tokenSwapData.curveParameters;
  const poolNonce =
    "poolNonce" in tokenSwapData ? tokenSwapData.poolNonce : undefined;
  return {
    address,
    programId,
    tokenProgramId,
    poolToken,
    feeAccount,
    authority,
    tokenAccountA,
    tokenAccountB,
    mintA,
    mintB,
    tradeFeeNumerator,
    tradeFeeDenominator,
    ownerTradeFeeNumerator,
    ownerTradeFeeDenominator,
    ownerWithdrawFeeNumerator,
    ownerWithdrawFeeDenominator,
    curveType,
    curveParameters,
    poolNonce,
  };
}

var CurveType;

(function (CurveType) {
  CurveType[(CurveType["ConstantProduct"] = 0)] = "ConstantProduct";
  CurveType[(CurveType["Stable"] = 2)] = "Stable";
})(CurveType || (CurveType = {})); // Abstract any SPL token swap based AMM

function createTokenSwapInstruction({
  tokenSwapState,
  sourceMint,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
  isStep,
}) {
  var _platformFee$feeBps3;

  const [swapSource, swapDestination] = sourceMint.equals(tokenSwapState.mintA)
    ? [tokenSwapState.tokenAccountA, tokenSwapState.tokenAccountB]
    : [tokenSwapState.tokenAccountB, tokenSwapState.tokenAccountA];
  return (
    isStep
      ? JUPITER_PROGRAM.instruction.stepTokenSwap
      : JUPITER_PROGRAM.instruction.tokenSwap
  )(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps3 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps3 !== void 0
      ? _platformFee$feeBps3
      : 0,
    {
      accounts: {
        tokenSwapProgram: tokenSwapState.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        swap: tokenSwapState.address,
        authority: tokenSwapState.authority,
        userTransferAuthority: userTransferAuthority,
        source: userSourceTokenAccount,
        swapSource,
        swapDestination,
        destination: userDestinationTokenAccount,
        poolMint: tokenSwapState.poolToken,
        poolFee: tokenSwapState.feeAccount,
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

class SplTokenSwapAmm {
  constructor(address, swapStateAccountInfo, label) {
    this.label = void 0;
    this.id = void 0;
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this.tokenSwapState = void 0;
    this.curveType = void 0;
    this.tokenAccounts = [];
    this.calculator = void 0;
    this.label = label;
    this.id = address.toBase58();
    this.tokenSwapState = accountInfoToTokenSwapState(
      address,
      swapStateAccountInfo
    );
    this.curveType = this.tokenSwapState.curveType;

    if (!(this.curveType in CurveType)) {
      throw new Error(
        `curveType ${this.tokenSwapState.curveType} is not supported`
      );
    }

    if (this.tokenSwapState.curveType === CurveType.ConstantProduct) {
      this.calculator = new math.TokenSwapConstantProduct(
        new math.Fraction(
          JSBI__default["default"].BigInt(
            this.tokenSwapState.tradeFeeNumerator.toString()
          ),
          JSBI__default["default"].BigInt(
            this.tokenSwapState.tradeFeeDenominator.toString()
          )
        ),
        new math.Fraction(
          JSBI__default["default"].BigInt(
            this.tokenSwapState.ownerTradeFeeNumerator.toString()
          ),
          JSBI__default["default"].BigInt(
            this.tokenSwapState.ownerTradeFeeDenominator.toString()
          )
        )
      );
    } else {
      this.calculator = new math.TokenSwapStable(
        JSBI__default["default"].BigInt(this.tokenSwapState.curveParameters[0]),
        new math.Fraction(
          JSBI__default["default"].BigInt(
            this.tokenSwapState.tradeFeeNumerator.toString()
          ),
          JSBI__default["default"].BigInt(
            this.tokenSwapState.tradeFeeDenominator.toString()
          )
        ),
        new math.Fraction(
          JSBI__default["default"].BigInt(
            this.tokenSwapState.ownerTradeFeeNumerator.toString()
          ),
          JSBI__default["default"].BigInt(
            this.tokenSwapState.ownerTradeFeeDenominator.toString()
          )
        )
      );
    }
  }

  getAccountsForUpdate() {
    return [
      this.tokenSwapState.tokenAccountA,
      this.tokenSwapState.tokenAccountB,
    ];
  }

  update(accountInfoMap) {
    const tokenAccountInfos = mapAddressToAccountInfos(
      accountInfoMap,
      this.getAccountsForUpdate()
    );
    this.tokenAccounts = tokenAccountInfos.map((info) => {
      const tokenAccount = optimist.deserializeAccount(info.data);

      if (!tokenAccount) {
        throw new Error("Invalid token account");
      }

      return tokenAccount;
    });
  }

  getQuote({ sourceMint, amount }) {
    if (this.tokenAccounts.length === 0) {
      throw new Error("Unable to fetch accounts for specified tokens.");
    }

    let feePct = new Decimal__default["default"](
      this.tokenSwapState.tradeFeeNumerator.toString()
    )
      .div(this.tokenSwapState.tradeFeeDenominator.toString())
      .add(
        new Decimal__default["default"](
          this.tokenSwapState.ownerTradeFeeNumerator.toString()
        ).div(this.tokenSwapState.ownerTradeFeeDenominator.toString())
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
    return [
      createTokenSwapInstruction({
        tokenSwapState: this.tokenSwapState,
        ...swapParams,
        inAmount: swapParams.amount,
        minimumOutAmount: swapParams.otherAmountThreshold,
        isStep: this.tokenSwapState.programId.equals(
          STEP_TOKEN_SWAP_PROGRAM_ID
        ),
      }),
    ];
  }

  get reserveTokenMints() {
    return [this.tokenSwapState.mintA, this.tokenSwapState.mintB];
  }
}

module.exports = {
  SplTokenSwapAmm,
};

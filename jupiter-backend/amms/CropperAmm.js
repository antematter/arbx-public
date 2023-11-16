const splToken = require("@solana/spl-token");
const math = require("@jup-ag/math");
const optimist = require("@mercurial-finance/optimist");
const web3 = require("@solana/web3.js");

const { JUPITER_PROGRAM } = require("../jupiter");
const { CROPPER_STATE_ADDRESS } = require("./constants");
const { CropperTokenSwapLayout } = require("./layouts");
const {
  prepareRemainingAccounts,
  mapAddressToAccountInfos,
  JSBI__default,
  Decimal__default,
  tokenAccountsToJSBIs,
} = require("./utils");

const accountInfoToCropperPoolState = (address, accountInfo) => {
  const programId = accountInfo.owner;
  const decoded = CropperTokenSwapLayout.decode(accountInfo.data);
  const [authority] = web3.PublicKey.findProgramAddressSync(
    [address.toBuffer()],
    programId
  );
  return {
    programId,
    authority,
    version: decoded.version,
    isInitialized: Boolean(decoded.isInitialized),
    nonce: decoded.nonce,
    ammId: decoded.ammId,
    serumProgramId: decoded.serumProgramId,
    tokenProgramId: decoded.tokenProgramId,
    tokenAAccount: decoded.tokenAAccount,
    tokenBAccount: decoded.tokenBAccount,
    serumMarket: decoded.serumMarket,
    poolMint: decoded.poolMint,
    mintA: decoded.mintA,
    mintB: decoded.mintB,
  };
};
const stateAccountInfoToCropperState = (accountInfo) => {
  const decoded = CropperStateLayout.decode(accountInfo.data);
  return {
    isInitialized: Boolean(decoded.isInitialized),
    stateOwner: decoded.stateOwner,
    feeOwner: decoded.feeOwner,
    initialSupply: decoded.initialSupply,
    returnFeeNumerator: decoded.returnFeeNumerator.toNumber(),
    fixedFeeNumerator: decoded.fixedFeeNumerator.toNumber(),
    feeDenominator: decoded.feeDenominator.toNumber(),
    curveType: decoded.curveType,
    curveParameters: decoded.curveParameters,
  };
};

function createCropperSwapInstruction({
  poolState,
  feeAccount,
  sourceMint,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps5;

  const [swapSource, swapDestination] = sourceMint.equals(poolState.mintA)
    ? [poolState.tokenAAccount, poolState.tokenBAccount]
    : [poolState.tokenBAccount, poolState.tokenAAccount];
  return JUPITER_PROGRAM.instruction.cropperTokenSwap(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps5 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps5 !== void 0
      ? _platformFee$feeBps5
      : 0,
    {
      accounts: {
        tokenSwapProgram: poolState.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        swap: poolState.ammId,
        swapState: CROPPER_STATE_ADDRESS,
        authority: poolState.authority,
        userTransferAuthority: userTransferAuthority,
        source: userSourceTokenAccount,
        swapSource,
        swapDestination,
        destination: userDestinationTokenAccount,
        poolMint: poolState.poolMint,
        poolFee: feeAccount,
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

class CropperAmm {
  // Hardcoded because no where to query this
  static async getStateFromStateAccount(connection) {
    const accountInfo = await connection.getAccountInfo(CROPPER_STATE_ADDRESS);

    if (!accountInfo) {
      throw new Error("State account not found");
    }

    return stateAccountInfoToCropperState(accountInfo);
  }

  constructor(address, accountInfo, params) {
    this.params = void 0;
    this.id = void 0;
    this.label = "Cropper";
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this.poolState = void 0;
    this.tokenAccounts = [];
    this.calculator = void 0;
    this.feePct = void 0;
    this.params = params;
    this.id = address.toBase58();
    this.poolState = accountInfoToCropperPoolState(address, accountInfo);
    this.feePct = new Decimal__default["default"](this.params.fixedFeeNumerator)
      .div(this.params.feeDenominator)
      .add(
        new Decimal__default["default"](this.params.returnFeeNumerator).div(
          this.params.feeDenominator
        )
      );
    this.params.tokenAFeeAccount = new web3.PublicKey(
      this.params.tokenAFeeAccount
    );
    this.params.tokenBFeeAccount = new web3.PublicKey(
      this.params.tokenBFeeAccount
    );
    this.calculator = new math.TokenSwapConstantProduct(
      new math.Fraction(
        JSBI__default["default"].BigInt(this.params.fixedFeeNumerator),
        JSBI__default["default"].BigInt(this.params.feeDenominator)
      ),
      new math.Fraction(
        JSBI__default["default"].BigInt(this.params.returnFeeNumerator),
        JSBI__default["default"].BigInt(this.params.feeDenominator)
      )
    );
  }

  getAccountsForUpdate() {
    return [this.poolState.tokenAAccount, this.poolState.tokenBAccount];
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

    const outputIndex = this.tokenAccounts[0].mint.equals(sourceMint) ? 1 : 0;
    const result = this.calculator.exchange(
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
      feePct: this.feePct.toNumber(),
      priceImpactPct: result.priceImpact.toNumber(),
    };
  }

  createSwapInstructions(swapParams) {
    const feeAccount = swapParams.sourceMint.equals(this.poolState.mintA)
      ? this.params.tokenAFeeAccount
      : this.params.tokenBFeeAccount;
    return [
      createCropperSwapInstruction({
        poolState: this.poolState,
        feeAccount,
        ...swapParams,
        inAmount: swapParams.amount,
        minimumOutAmount: swapParams.otherAmountThreshold,
      }),
    ];
  }

  get reserveTokenMints() {
    return [this.poolState.mintA, this.poolState.mintB];
  }
}
CropperAmm.decodePoolState = accountInfoToCropperPoolState;

module.exports = {
  CropperAmm,
};

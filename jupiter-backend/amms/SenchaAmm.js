const splToken = require("@solana/spl-token");
const math = require("@jup-ag/math");
const optimist = require("@mercurial-finance/optimist");

const { JUPITER_PROGRAM } = require("../jupiter");
const { SenchaSwapLayout } = require("./layouts");
const {
  prepareRemainingAccounts,
  mapAddressToAccountInfos,
  JSBI__default,
  tokenAccountsToJSBIs,
} = require("./utils");

const accountInfoToSenchaPoolState = (address, accountInfo) => {
  const programId = accountInfo.owner;
  const decoded = SenchaSwapLayout.decode(accountInfo.data);
  return {
    programId,
    isPaused: Boolean(decoded.isPaused),
    bump: decoded.bump,
    ammId: address,
    token0Reserves: decoded.token0Reserves,
    token1Reserves: decoded.token1Reserves,
    token0Mint: decoded.token0Mint,
    token1Mint: decoded.token1Mint,
    token0Fees: decoded.token0Fees,
    token1Fees: decoded.token1Fees,
    poolMint: decoded.poolMint,
    tradeFeeKbps: decoded.tradeFeeKbps.toNumber(),
  };
};

function createSenchaSwapInstruction({
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
  var _platformFee$feeBps4;

  const [swapSource, swapDestination] = sourceMint.equals(poolState.token0Mint)
    ? [poolState.token0Reserves, poolState.token1Reserves]
    : [poolState.token1Reserves, poolState.token0Reserves];
  const [feesSource, feesDestination] = sourceMint.equals(poolState.token0Mint)
    ? [poolState.token0Fees, poolState.token1Fees]
    : [poolState.token1Fees, poolState.token0Fees];
  return JUPITER_PROGRAM.instruction.senchaExchange(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps4 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps4 !== void 0
      ? _platformFee$feeBps4
      : 0,
    {
      accounts: {
        swapProgram: poolState.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        swap: poolState.ammId,
        userAuthority: userTransferAuthority,
        inputUserAccount: userSourceTokenAccount,
        inputTokenAccount: swapSource,
        inputFeesAccount: feesSource,
        outputUserAccount: userDestinationTokenAccount,
        outputTokenAccount: swapDestination,
        outputFeesAccount: feesDestination,
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

class SenchaAmm {
  constructor(address, accountInfo) {
    this.id = void 0;
    this.label = "Sencha";
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this.poolState = void 0;
    this.calculator = void 0;
    this.tokenAccounts = [];
    this.id = address.toBase58();
    this.poolState = accountInfoToSenchaPoolState(address, accountInfo);
    this.calculator = new math.TokenSwapConstantProduct(
      new math.Fraction(
        JSBI__default["default"].BigInt(this.poolState.tradeFeeKbps),
        JSBI__default["default"].BigInt(10000000)
      ),
      new math.Fraction(math.ZERO, math.ZERO),
      false
    );
  }

  get isPaused() {
    return this.poolState.isPaused;
  }

  getAccountsForUpdate() {
    return [this.poolState.token0Reserves, this.poolState.token1Reserves];
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
    let result = this.calculator.exchange(
      tokenAccountsToJSBIs(this.tokenAccounts),
      JSBI__default["default"].BigInt(amount),
      outputIndex
    );
    let feePct = this.poolState.tradeFeeKbps / 10000000; // 100% kbps

    return {
      notEnoughLiquidity: false,
      inAmount: amount,
      outAmount: result.expectedOutputAmount,
      feeAmount: result.fees,
      feeMint: sourceMint.toBase58(),
      feePct,
      priceImpactPct: result.priceImpact.toNumber(),
    };
  }

  createSwapInstructions(swapParams) {
    return [
      createSenchaSwapInstruction({
        poolState: this.poolState,
        ...swapParams,
        inAmount: swapParams.amount,
        minimumOutAmount: swapParams.otherAmountThreshold,
      }),
    ];
  }

  get reserveTokenMints() {
    return [this.poolState.token0Mint, this.poolState.token1Mint];
  }
}

module.exports = {
  SenchaAmm,
};

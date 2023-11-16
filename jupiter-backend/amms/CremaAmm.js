const splToken = require("@solana/spl-token");
const web3 = require("@solana/web3.js");
const math = require("@jup-ag/math");
const cremaSdk = require("@jup-ag/crema-sdk");

const { JUPITER_PROGRAM } = require("../jupiter");
const {
  prepareRemainingAccounts,
  mapAddressToAccountInfos,
  JSBI__default,
  Decimal__default,
} = require("./utils");

const accountInfoToCremaPoolState = (address, accountInfo) => {
  const programId = accountInfo.owner;
  const decoded = cremaSdk.TokenSwapAccountLayout.decode(accountInfo.data);
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
    ammId: address,
    tokenProgramId: decoded.tokenProgramId,
    tokenAAccount: decoded.swapTokenA,
    tokenBAccount: decoded.swapTokenB,
    ticksKey: decoded.ticksKey,
    mintA: decoded.tokenAMint,
    mintB: decoded.tokenBMint,
    fee: decoded.fee,
    currentSqrtPrice: decoded.currentSqrtPrice,
    currentLiquity: decoded.currentLiquity,
  };
};

function createCremaSwapInstruction({
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
  var _platformFee$feeBps9;

  const [swapSource, swapDestination] = sourceMint.equals(poolState.mintA)
    ? [poolState.tokenAAccount, poolState.tokenBAccount]
    : [poolState.tokenBAccount, poolState.tokenAAccount];
  return JUPITER_PROGRAM.instruction.cremaTokenSwap(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps9 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps9 !== void 0
      ? _platformFee$feeBps9
      : 0,
    {
      accounts: {
        swapProgram: poolState.programId,
        pool: poolState.ammId,
        poolSigner: poolState.authority,
        userSourceTokenAccount: userSourceTokenAccount,
        userDestinationTokenAccount: userDestinationTokenAccount,
        poolSourceTokenAccount: swapSource,
        poolDestinationTokenAccount: swapDestination,
        poolTicksAccount: poolState.ticksKey,
        walletAuthority: userTransferAuthority,
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

class CremaAmm {
  constructor(address, accountInfo) {
    this.id = void 0;
    this.label = "Crema";
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this.ticks = void 0;
    this.poolState = void 0;
    this.poolState = accountInfoToCremaPoolState(address, accountInfo);
    this.id = address.toBase58();
  }

  getAccountsForUpdate() {
    return [this.poolState.ammId, this.poolState.ticksKey];
  }

  update(accountInfoMap) {
    const [tokenSwapAccountInfo, ticksAccountInfo] = mapAddressToAccountInfos(
      accountInfoMap,
      this.getAccountsForUpdate()
    );
    this.poolState = accountInfoToCremaPoolState(
      this.poolState.ammId,
      tokenSwapAccountInfo
    );
    const ticksInfo = cremaSdk.parseTicksAccount(
      this.poolState.ticksKey,
      ticksAccountInfo
    );
    if (!ticksInfo)
      throw new Error(
        `Ticks account invalid: ${this.poolState.ticksKey.toBase58()}`
      );
    this.ticks = ticksInfo.data.ticks;
  }

  getQuote({ sourceMint, amount }) {
    if (!this.ticks) {
      throw new Error("Unable to fetch accounts for ticks.");
    } // Crema SDK doesn't support 0 amount input

    if (JSBI__default["default"].equal(amount, math.ZERO)) {
      return {
        notEnoughLiquidity: false,
        inAmount: amount,
        outAmount: math.ZERO,
        feeAmount: math.ZERO,
        feeMint: sourceMint.toBase58(),
        feePct: this.poolState.fee.toNumber(),
        priceImpactPct: 0,
      };
    }

    const result = this.poolState.mintA.equals(sourceMint)
      ? this.preSwapA(new Decimal__default["default"](amount.toString()))
      : this.preSwapB(new Decimal__default["default"](amount.toString()));

    if (result.revert) {
      throw new Error("Crema error: insufficient liquidity");
    }

    return {
      notEnoughLiquidity: false,
      inAmount: amount,
      outAmount: JSBI__default["default"].BigInt(result.amountOut.toString()),
      feeAmount: JSBI__default["default"].BigInt(result.feeUsed.toString()),
      feeMint: sourceMint.toBase58(),
      feePct: this.poolState.fee.toNumber(),
      priceImpactPct: result.impact.toNumber(),
    };
  }

  preSwapA(amountIn) {
    if (!this.ticks) {
      throw new Error("Unable to fetch accounts for ticks.");
    }

    const result = cremaSdk.calculateSwapA2B(
      this.ticks,
      this.poolState.currentSqrtPrice,
      this.poolState.fee,
      this.poolState.currentLiquity,
      amountIn
    );
    const currentPriceA = this.poolState.currentSqrtPrice.pow(2);
    const transactionPriceA = result.amountOut.div(result.amountUsed);
    const impact = transactionPriceA
      .sub(currentPriceA)
      .div(currentPriceA)
      .abs();
    const revert = result.amountUsed.lessThan(amountIn);
    return { ...result, impact, revert };
  }

  preSwapB(amountIn) {
    if (!this.ticks) {
      throw new Error("Unable to fetch accounts for ticks.");
    }

    const result = cremaSdk.calculateSwapB2A(
      this.ticks,
      this.poolState.currentSqrtPrice,
      this.poolState.fee,
      this.poolState.currentLiquity,
      amountIn
    );
    const currentPriceA = this.poolState.currentSqrtPrice.pow(2);
    const currentPriceB = new Decimal__default["default"](1).div(currentPriceA);
    const transactionPriceB = result.amountOut.div(result.amountUsed);
    const impact = transactionPriceB
      .sub(currentPriceB)
      .div(currentPriceB)
      .abs();
    const revert = result.amountUsed.lessThan(amountIn);
    return { ...result, impact, revert };
  }

  createSwapInstructions(swapParams) {
    return [
      createCremaSwapInstruction({
        poolState: this.poolState,
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

module.exports = {
  CremaAmm,
};

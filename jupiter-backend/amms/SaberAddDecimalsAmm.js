const splToken = require("@solana/spl-token");
const math = require("@jup-ag/math");

const { JUPITER_PROGRAM } = require("../jupiter");
const { SABER_ADD_DECIMALS_PROGRAM_ID } = require("./constants");
const { prepareRemainingAccounts, JSBI__default } = require("./utils");

function createSaberAddDecimalsDepositInstruction({
  addDecimals,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps12;

  const remainingAccounts = prepareRemainingAccounts(
    inAmount,
    tokenLedger,
    platformFee === null || platformFee === void 0
      ? void 0
      : platformFee.feeAccount
  );
  return JUPITER_PROGRAM.instruction.saberAddDecimalsDeposit(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps12 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps12 !== void 0
      ? _platformFee$feeBps12
      : 0,
    {
      accounts: {
        addDecimalsProgram: SABER_ADD_DECIMALS_PROGRAM_ID,
        wrapper: addDecimals.wrapper,
        wrapperMint: addDecimals.mint,
        wrapperUnderlyingTokens: addDecimals.wrapperUnderlyingTokens,
        owner: userTransferAuthority,
        userUnderlyingTokens: userSourceTokenAccount,
        userWrappedTokens: userDestinationTokenAccount,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
      },
      remainingAccounts,
    }
  );
}

function createSaberAddDecimalsWithdrawInstruction({
  addDecimals,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps13;

  const remainingAccounts = prepareRemainingAccounts(
    inAmount,
    tokenLedger,
    platformFee === null || platformFee === void 0
      ? void 0
      : platformFee.feeAccount
  );
  return JUPITER_PROGRAM.instruction.saberAddDecimalsWithdraw(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps13 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps13 !== void 0
      ? _platformFee$feeBps13
      : 0,
    {
      accounts: {
        addDecimalsProgram: SABER_ADD_DECIMALS_PROGRAM_ID,
        wrapper: addDecimals.wrapper,
        wrapperMint: addDecimals.mint,
        wrapperUnderlyingTokens: addDecimals.wrapperUnderlyingTokens,
        owner: userTransferAuthority,
        userUnderlyingTokens: userDestinationTokenAccount,
        userWrappedTokens: userSourceTokenAccount,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
      },
      remainingAccounts,
    }
  );
}

class WrappedToken {
  constructor(addDecimals) {
    this.addDecimals = void 0;
    this.multiplier = void 0;
    this.addDecimals = addDecimals;
    this.multiplier = JSBI__default["default"].BigInt(
      10 ** (this.addDecimals.decimals - this.addDecimals.underlyingDecimals)
    );
  }

  getOutputAmount(inputAmount, inputMint) {
    if (this.addDecimals.mint.equals(inputMint)) {
      // withdraw, so divide
      return this.calculateWithdrawOutputAmount(inputAmount);
    } else if (this.addDecimals.underlying.equals(inputMint)) {
      // deposit, so multiply
      return this.calculateDepositOutputAmount(inputAmount);
    }

    throw new Error(`unknown input token: ${inputMint.toString()}`);
  }

  calculateDepositOutputAmount(inputAmount) {
    return JSBI__default["default"].multiply(inputAmount, this.multiplier);
  }

  calculateWithdrawOutputAmount(inputAmount) {
    return JSBI__default["default"].divide(inputAmount, this.multiplier);
  }
} // This isn't technically an Amm but this the smoothest solution to allow its usage without a major refactor of the abstractions for now

class SaberAddDecimalsAmm {
  constructor(wrappedToken) {
    this.wrappedToken = void 0;
    this.id = void 0;
    this.label = "Saber (Decimals)";
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this.wrappedToken = wrappedToken;
    this.id = this.wrappedToken.addDecimals.wrapper.toBase58();
  }

  getAccountsForUpdate() {
    return new Array();
  }

  update(_accountInfoMap) {}

  getQuote({ sourceMint, amount }) {
    const outAmount = this.wrappedToken.getOutputAmount(amount, sourceMint);
    return {
      notEnoughLiquidity: false,
      inAmount: amount,
      outAmount,
      feeAmount: math.ZERO,
      feeMint: sourceMint.toBase58(),
      feePct: 0,
      priceImpactPct: 0,
    };
  }

  createSwapInstructions(swapParams) {
    if (
      this.wrappedToken.addDecimals.underlying.equals(swapParams.sourceMint)
    ) {
      return [
        createSaberAddDecimalsDepositInstruction({
          addDecimals: this.wrappedToken.addDecimals,
          ...swapParams,
          inAmount: swapParams.amount,
          minimumOutAmount: swapParams.otherAmountThreshold,
        }),
      ];
    } else {
      return [
        createSaberAddDecimalsWithdrawInstruction({
          addDecimals: this.wrappedToken.addDecimals,
          ...swapParams,
          inAmount: swapParams.amount,
          minimumOutAmount: swapParams.otherAmountThreshold,
        }),
      ];
    }
  }

  get reserveTokenMints() {
    return [
      this.wrappedToken.addDecimals.underlying,
      this.wrappedToken.addDecimals.mint,
    ];
  }
}

module.exports = {
  SaberAddDecimalsAmm,
  WrappedToken,
};

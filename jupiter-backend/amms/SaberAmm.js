const splToken = require("@solana/spl-token");
const math = require("@jup-ag/math");
const optimist = require("@mercurial-finance/optimist");
const stableswapSdk = require("@saberhq/stableswap-sdk");

const { JUPITER_PROGRAM } = require("../jupiter");
const {
  prepareRemainingAccounts,
  mapAddressToAccountInfos,
  tokenAccountsToJSBIs,
  Decimal__default,
} = require("./utils");


function saberPoolIntoSaberSwap(
  saberPool,
  sourceMintAddress,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority
) {
  const feesTokenAccount = sourceMintAddress.equals(saberPool.state.tokenA.mint)
    ? saberPool.state.tokenB.adminFeeAccount
    : saberPool.state.tokenA.adminFeeAccount;
  const [inputTokenAccount, outputTokenAccount] = sourceMintAddress.equals(
    saberPool.state.tokenA.mint
  )
    ? [saberPool.state.tokenA.reserve, saberPool.state.tokenB.reserve]
    : [saberPool.state.tokenB.reserve, saberPool.state.tokenA.reserve];
  return {
    swapProgram: saberPool.config.swapProgramID,
    tokenProgram: splToken.TOKEN_PROGRAM_ID,
    swap: saberPool.config.swapAccount,
    swapAuthority: saberPool.config.authority,
    userAuthority: userTransferAuthority,
    inputUserAccount: userSourceTokenAccount,
    inputTokenAccount,
    outputUserAccount: userDestinationTokenAccount,
    outputTokenAccount,
    feesTokenAccount,
  };
}

function createSaberSwapInstruction({
  stableSwap,
  sourceMint,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps11;

  const remainingAccounts = prepareRemainingAccounts(
    inAmount,
    tokenLedger,
    platformFee === null || platformFee === void 0
      ? void 0
      : platformFee.feeAccount
  );
  return JUPITER_PROGRAM.instruction.saberSwap(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps11 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps11 !== void 0
      ? _platformFee$feeBps11
      : 0,
    {
      accounts: saberPoolIntoSaberSwap(
        stableSwap,
        sourceMint,
        userSourceTokenAccount,
        userDestinationTokenAccount,
        userTransferAuthority
      ),
      remainingAccounts,
    }
  );
}

class SaberAmm {
  constructor(stableSwap) {
    this.stableSwap = void 0;
    this.id = void 0;
    this.label = "Saber";
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this.tokenAccounts = [];
    this.calculator = void 0;
    this.stableSwap = stableSwap;
    this.id = stableSwap.config.swapAccount.toBase58();
    this.calculator = new math.Stable(
      math.TWO,
      stableswapSdk.calculateAmpFactor(this.stableSwap.state),
      [math.ONE, math.ONE],
      new math.Fraction(
        this.stableSwap.state.fees.trade.numerator,
        this.stableSwap.state.fees.trade.denominator
      )
    );
  }

  getAccountsForUpdate() {
    return [
      this.stableSwap.state.tokenA.reserve,
      this.stableSwap.state.tokenB.reserve,
    ];
  }

  update(accountInfoMap) {
    let tokenAccountInfos = mapAddressToAccountInfos(
      accountInfoMap,
      this.getAccountsForUpdate()
    );
    this.tokenAccounts = tokenAccountInfos.map((info) => {
      const tokenAccount = optimist.deserializeAccount(info.data);

      if (!tokenAccount) {
        throw new Error("Invalid token account data");
      }

      return tokenAccount;
    });
  }

  getQuote({ sourceMint, destinationMint, amount }) {
    if (this.tokenAccounts.length === 0) {
      throw new Error("Unable to fetch accounts for specified tokens.");
    }

    const feePct = new Decimal__default["default"](
      this.stableSwap.state.fees.trade.asFraction.toFixed(4)
    );
    const [inputIndex, outputIndex] = this.tokenAccounts[0].mint.equals(
      sourceMint
    )
      ? [0, 1]
      : [1, 0];
    this.calculator.setAmp(
      stableswapSdk.calculateAmpFactor(this.stableSwap.state)
    );
    const result = this.calculator.exchange(
      tokenAccountsToJSBIs(this.tokenAccounts),
      amount,
      inputIndex,
      outputIndex
    );
    return {
      notEnoughLiquidity: false,
      inAmount: amount,
      outAmount: result.expectedOutputAmount,
      feeAmount: result.fees,
      feeMint: destinationMint.toBase58(),
      feePct: feePct.toNumber(),
      priceImpactPct: result.priceImpact.toNumber(),
    };
  }

  createSwapInstructions(swapParams) {
    return [
      createSaberSwapInstruction({
        stableSwap: this.stableSwap,
        ...swapParams,
        inAmount: swapParams.amount,
        minimumOutAmount: swapParams.otherAmountThreshold,
      }),
    ];
  }

  get reserveTokenMints() {
    return [
      this.stableSwap.state.tokenA.mint,
      this.stableSwap.state.tokenB.mint,
    ];
  }
}

module.exports = {
  SaberAmm,
};

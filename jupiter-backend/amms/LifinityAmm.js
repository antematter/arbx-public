const splToken = require("@solana/spl-token");
const web3 = require("@solana/web3.js");
const lifinitySdk = require("@jup-ag/lifinity-sdk");

const { JUPITER_PROGRAM } = require("../jupiter");
const {
  prepareRemainingAccounts,
  JSBI__default,
  Decimal__default,
} = require("./utils");

const accountInfoLifinitySwapLayout = (address, accountInfo) => {
  const programId = accountInfo.owner;
  const decoded = lifinitySdk.LIFINITY_AMM_LAYOUT.decode(accountInfo.data);
  const [authority] = web3.PublicKey.findProgramAddressSync(
    [address.toBuffer()],
    programId
  );
  return {
    programId,
    authority,
    amm: address,
    tokenAMint: decoded.tokenAMint,
    tokenBMint: decoded.tokenBMint,
    poolMint: decoded.poolMint,
    feeAccount: decoded.poolFeeAccount,
    pythAccount: decoded.pythAccount,
    pythPcAccount: decoded.pythPcAccount,
    configAccount: decoded.configAccount,
    poolCoinTokenAccount: decoded.tokenAAccount,
    poolCoinMint: decoded.tokenAMint,
    poolPcTokenAccount: decoded.tokenBAccount,
    poolPcMint: decoded.tokenBMint,
  };
};

const swapStateToPoolInfo = (state) => {
  return {
    amm: state.amm.toBase58(),
    configAccount: state.configAccount.toBase58(),
    feeAccount: state.feeAccount.toBase58(),
    pythAccount: state.pythAccount.toBase58(),
    pythPcAccount: state.pythPcAccount.toBase58(),
    poolCoinMint: state.poolCoinMint.toBase58(),
    poolCoinTokenAccount: state.poolCoinTokenAccount.toBase58(),
    poolMint: state.poolMint.toBase58(),
    poolPcTokenAccount: state.poolPcTokenAccount.toBase58(),
    poolPcMint: state.poolPcMint.toBase58(),
    // We don't use decimals at the moment, so default to 0, if we need to use it later, we can add it from API
    poolCoinDecimal: 0,
    poolPcDecimal: 0,
    poolMintDecimal: 0,
    pythBaseDecimal: 0,
  };
};

function createLifinitySwapInstruction({
  swapState,
  sourceMint,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps14;

  const [swapSource, swapDestination] = sourceMint.equals(swapState.tokenAMint)
    ? [swapState.poolCoinTokenAccount, swapState.poolPcTokenAccount]
    : [swapState.poolPcTokenAccount, swapState.poolCoinTokenAccount];
  return JUPITER_PROGRAM.instruction.lifinityTokenSwap(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps14 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps14 !== void 0
      ? _platformFee$feeBps14
      : 0,
    {
      accounts: {
        swapProgram: swapState.programId,
        authority: swapState.authority,
        amm: swapState.amm,
        userTransferAuthority: userTransferAuthority,
        sourceInfo: userSourceTokenAccount,
        destinationInfo: userDestinationTokenAccount,
        swapSource,
        swapDestination,
        poolMint: swapState.poolMint,
        feeAccount: swapState.feeAccount,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        pythAccount: swapState.pythAccount,
        pythPcAccount: swapState.pythPcAccount,
        configAccount: swapState.configAccount,
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
class LifinityAmm {
  constructor(address, ammAccountInfo) {
    this.ammAccountInfo = void 0;
    this.id = void 0;
    this.label = "Lifinity";
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this.swapState = void 0;
    this.poolInfo = void 0;
    this.accountInfos = [];
    this.ammAccountInfo = ammAccountInfo;
    this.id = address.toBase58();
    this.swapState = accountInfoLifinitySwapLayout(address, ammAccountInfo);
    this.poolInfo = swapStateToPoolInfo(this.swapState);
  }

  getAccountsForUpdate() {
    return [
      this.swapState.poolCoinTokenAccount,
      this.swapState.poolPcTokenAccount,
      this.swapState.configAccount,
      this.swapState.pythAccount,
      this.swapState.pythPcAccount,
    ];
  }

  update(accountInfoMap) {
    this.getAccountsForUpdate().forEach((publicKey, idx) => {
      const account = accountInfoMap.get(publicKey.toBase58());

      if (account) {
        this.accountInfos[idx] = {
          publicKey,
          account,
        };
      }
    });
  }

  getQuote({ sourceMint, amount }) {
    if (this.accountInfos.length !== this.getAccountsForUpdate().length) {
      throw new Error("Accounts not loaded");
    }

    const tradeDirection = this.swapState.poolCoinMint.equals(sourceMint)
      ? lifinitySdk.TradeDirection.AtoB
      : lifinitySdk.TradeDirection.BtoA;
    const { amm, pyth, pythPc, fees, coinBalance, pcBalance, config } =
      lifinitySdk.getParsedData(
        [
          {
            publicKey: this.swapState.amm,
            account: this.ammAccountInfo,
          },
          ...this.accountInfos,
        ],
        this.poolInfo
      );

    if (
      !pyth.status.equals(1) || // pythPc can be undefined from the lifinity SDK
      (pythPc && !pythPc.status.equals(1))
    ) {
      throw new Error("Pyth accounts are outdated");
    }

    const amountIn = new Decimal__default["default"](amount.toString());
    const result = lifinitySdk.getCurveAmount(
      amountIn,
      pyth.publishSlot.toNumber(), // Use pyth publish slot to not throw error
      amm,
      fees,
      coinBalance,
      pcBalance,
      config,
      pyth,
      pythPc,
      tradeDirection
    );
    return {
      notEnoughLiquidity: false,
      inAmount: amount,
      outAmount: JSBI__default["default"].BigInt(
        result.amountSwapped.toString()
      ),
      feeAmount: JSBI__default["default"].BigInt(result.fee.ceil().toString()),
      feeMint: sourceMint.toBase58(),
      feePct: result.feePercent.toNumber(),
      priceImpactPct: result.priceImpact.toNumber(),
    };
  }

  createSwapInstructions(swapParams) {
    return [
      createLifinitySwapInstruction({
        swapState: this.swapState,
        ...swapParams,
        inAmount: swapParams.amount,
        minimumOutAmount: swapParams.otherAmountThreshold,
      }),
    ];
  }

  get reserveTokenMints() {
    return [this.swapState.poolCoinMint, this.swapState.poolPcMint];
  }
}

module.exports = {
  LifinityAmm,
};

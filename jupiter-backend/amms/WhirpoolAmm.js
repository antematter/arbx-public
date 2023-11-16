const splToken = require("@solana/spl-token");
const web3 = require("@solana/web3.js");
const whirlpoolSdk = require("@jup-ag/whirlpool-sdk");

const { JUPITER_PROGRAM } = require("../jupiter");
const { WHIRLPOOL_PROGRAM_ID } = require("./constants");
const {
  prepareRemainingAccounts,
  SwapMode,
  JSBI__default,
  Decimal__default,
  BN__default,
} = require("./utils");

const FEE_RATE_MUL_VALUE = 1000000;

function fromX64(num) {
  return new Decimal__default["default"](num.toString()).mul(
    Decimal__default["default"].pow(2, -64)
  );
}

function parseWhirlpoolSafe(address, data) {
  const whirlpoolData = whirlpoolSdk.parseWhirlpool(data);
  if (!whirlpoolData)
    throw new Error(`Failed to parse whirlpool ${address.toBase58()}`);
  return whirlpoolData;
}

function createWhirlpoolSwapInstruction({
  additionalArgs,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps16;

  const [tokenOwnerAccountA, tokenOwnerAccountB] = additionalArgs.aToB
    ? [userSourceTokenAccount, userDestinationTokenAccount]
    : [userDestinationTokenAccount, userSourceTokenAccount];
  return JUPITER_PROGRAM.instruction.whirlpoolSwap(
    inAmount,
    minimumOutAmount,
    additionalArgs.aToB,
    (_platformFee$feeBps16 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps16 !== void 0
      ? _platformFee$feeBps16
      : 0,
    {
      accounts: {
        swapProgram: WHIRLPOOL_PROGRAM_ID,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        tokenAuthority: userTransferAuthority,
        whirlpool: additionalArgs.whirlpool,
        tokenOwnerAccountA,
        tokenVaultA: additionalArgs.tokenVaultA,
        tokenOwnerAccountB,
        tokenVaultB: additionalArgs.tokenVaultB,
        tickArray0: additionalArgs.tickArray0,
        tickArray1: additionalArgs.tickArray1,
        tickArray2: additionalArgs.tickArray2,
        oracle: additionalArgs.oracle,
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

function createWhirlpoolSwapExactOutputInstruction({
  additionalArgs,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  outAmount,
  maximumInAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps19;

  const [tokenOwnerAccountA, tokenOwnerAccountB] = additionalArgs.aToB
    ? [userSourceTokenAccount, userDestinationTokenAccount]
    : [userDestinationTokenAccount, userSourceTokenAccount];
  return JUPITER_PROGRAM.instruction.whirlpoolSwapExactOutput(
    outAmount,
    maximumInAmount,
    additionalArgs.aToB,
    (_platformFee$feeBps19 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps19 !== void 0
      ? _platformFee$feeBps19
      : 0,
    {
      accounts: {
        swapProgram: WHIRLPOOL_PROGRAM_ID,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        tokenAuthority: userTransferAuthority,
        whirlpool: additionalArgs.whirlpool,
        tokenOwnerAccountA,
        tokenVaultA: additionalArgs.tokenVaultA,
        tokenOwnerAccountB,
        tokenVaultB: additionalArgs.tokenVaultB,
        tickArray0: additionalArgs.tickArray0,
        tickArray1: additionalArgs.tickArray1,
        tickArray2: additionalArgs.tickArray2,
        oracle: additionalArgs.oracle,
      },
      remainingAccounts: prepareRemainingAccounts(
        new BN__default["default"](0),
        tokenLedger,
        platformFee === null || platformFee === void 0
          ? void 0
          : platformFee.feeAccount
      ),
    }
  );
}

class WhirlpoolAmm {
  constructor(address, whirlpoolAccountInfo) {
    this.address = void 0;
    this.id = void 0;
    this.label = "Orca (Whirlpools)";
    this.shouldPrefetch = true;
    this.exactOutputSupported = true;
    this.whirlpoolData = void 0;
    this.tickArrays = new Map();
    this.tickPks = void 0;
    this.oracle = void 0;
    this.feePct = void 0;
    this.address = address;
    this.id = address.toBase58();
    this.whirlpoolData = parseWhirlpoolSafe(address, whirlpoolAccountInfo.data);
    this.oracle = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("oracle"), address.toBuffer()],
      WHIRLPOOL_PROGRAM_ID
    )[0];
    this.feePct = new Decimal__default["default"](
      this.whirlpoolData.feeRate
    ).div(FEE_RATE_MUL_VALUE);
    this.tickPks = whirlpoolSdk.getTickArrayPks(address, this.whirlpoolData);
  }

  getAccountsForUpdate() {
    // The tickCurrentIndex is technically behind here, belonging to the last refresh
    return [this.address, ...this.tickPks];
  }

  update(accountInfoMap) {
    const whirlpoolAccountInfo = accountInfoMap.get(this.address.toBase58());
    if (!whirlpoolAccountInfo)
      throw new Error(`Missing ${this.address.toBase58()}`);
    this.whirlpoolData = parseWhirlpoolSafe(
      this.address,
      whirlpoolAccountInfo.data
    );
    this.tickPks = whirlpoolSdk.getTickArrayPks(
      this.address,
      this.whirlpoolData
    );
    this.tickArrays.clear();

    for (const tickArrayPk of this.tickPks) {
      const tickArrayAddress = tickArrayPk.toBase58();
      const tickArrayAccountInfo = accountInfoMap.get(tickArrayAddress);

      if (!tickArrayAccountInfo) {
        // This can happen if we reach an uninitialized tick, and it is likely to occur right now
        continue;
      }

      const tickArray = whirlpoolSdk.parseTickArray(tickArrayAccountInfo.data);
      if (!tickArray)
        throw new Error(`Could not parse tick array ${tickArrayAddress}`);
      this.tickArrays.set(tickArrayAddress, tickArray);
    }
  }

  getQuote({ sourceMint, destinationMint, amount, swapMode }) {
    const swapQuote = whirlpoolSdk.getSwapQuote({
      poolAddress: this.address,
      whirlpool: this.whirlpoolData,
      tickArrays: this.tickArrays,
      tokenMint: swapMode === SwapMode.ExactIn ? sourceMint : destinationMint,
      tokenAmount: new BN__default["default"](amount.toString()),
      isInput: swapMode === SwapMode.ExactIn,
    });
    const inAmount = JSBI__default["default"].BigInt(
      swapQuote.amountIn.toString()
    );
    const outAmount = JSBI__default["default"].BigInt(
      swapQuote.amountOut.toString()
    );
    const feeAmount = JSBI__default["default"].BigInt(
      this.feePct.mul(inAmount.toString()).floor().toString()
    );
    const quotePrice = swapQuote.aToB
      ? new Decimal__default["default"](swapQuote.amountOut.toString()).div(
          swapQuote.amountIn.toString()
        )
      : new Decimal__default["default"](swapQuote.amountIn.toString()).div(
          swapQuote.amountOut.toString()
        );
    const currentPrice = fromX64(this.whirlpoolData.sqrtPrice).pow(2);
    const priceImpactPct = currentPrice
      .minus(quotePrice)
      .div(currentPrice)
      .abs()
      .toNumber();
    return {
      notEnoughLiquidity: false,
      inAmount,
      outAmount,
      feeAmount,
      feeMint: sourceMint.toBase58(),
      feePct: this.feePct.toNumber(),
      priceImpactPct: Number(priceImpactPct),
    };
  }

  createSwapInstructions(swapParams) {
    const aToB = swapParams.sourceMint.equals(this.whirlpoolData.tokenMintA);
    const [tickArray0, tickArray1, tickArray2] =
      whirlpoolSdk.getTickArrayPublicKeysForSwap(
        this.whirlpoolData.tickCurrentIndex,
        this.whirlpoolData.sqrtPrice,
        this.whirlpoolData.tickSpacing,
        this.address,
        this.tickArrays,
        WHIRLPOOL_PROGRAM_ID,
        aToB
      );
    const ix =
      swapParams.swapMode === SwapMode.ExactIn
        ? createWhirlpoolSwapInstruction({
            additionalArgs: {
              aToB,
              whirlpool: this.address,
              tickArray0,
              tickArray1,
              tickArray2,
              oracle: this.oracle,
              ...this.whirlpoolData,
            },
            ...swapParams,
            inAmount: swapParams.amount,
            minimumOutAmount: swapParams.otherAmountThreshold,
          })
        : (() => {
            if (swapParams.amount === null)
              throw Error("amount cannot be null with exact output");
            return createWhirlpoolSwapExactOutputInstruction({
              additionalArgs: {
                aToB,
                whirlpool: this.address,
                tickArray0,
                tickArray1,
                tickArray2,
                oracle: this.oracle,
                ...this.whirlpoolData,
              },
              ...swapParams,
              outAmount: swapParams.amount,
              maximumInAmount: swapParams.otherAmountThreshold,
            });
          })();
    return [ix];
  }

  get reserveTokenMints() {
    return [this.whirlpoolData.tokenMintA, this.whirlpoolData.tokenMintB];
  }
}

module.exports = {
  WhirlpoolAmm,
};

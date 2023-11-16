const splToken = require("@solana/spl-token");
const web3 = require("@solana/web3.js");
const math = require("@jup-ag/math");
const serum = require('@project-serum/serum');

const { RAYDIUM_AMM_V4_PROGRAM_ID } = require("./constants");
const { AMM_INFO_LAYOUT_V4 } = require("./layouts");
const { JUPITER_PROGRAM } = require("../jupiter");
const {
  prepareRemainingAccounts,
  mapAddressToAccountInfos,
  Decimal__default,
  JSBI__default,
} = require("./utils");

function raydiumAmmToRaydiumSwap(
  raydiumAmm,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority
) {
  const [ammAuthority] = web3.PublicKey.findProgramAddressSync(
    [
      new Uint8Array(
        Buffer.from("amm authority".replace("\u00A0", " "), "utf-8")
      ),
    ],
    RAYDIUM_AMM_V4_PROGRAM_ID
  );

  if (!raydiumAmm.serumMarketKeys) {
    throw new Error("RaydiumAmm is missing serumMarketKeys");
  }

  return {
    swapProgram: RAYDIUM_AMM_V4_PROGRAM_ID,
    tokenProgram: splToken.TOKEN_PROGRAM_ID,
    ammId: raydiumAmm.ammId,
    ammAuthority,
    ammOpenOrders: raydiumAmm.ammOpenOrders,
    poolCoinTokenAccount: raydiumAmm.poolCoinTokenAccount,
    poolPcTokenAccount: raydiumAmm.poolPcTokenAccount,
    serumProgramId: raydiumAmm.serumProgramId,
    serumMarket: raydiumAmm.serumMarket,
    serumBids: raydiumAmm.serumMarketKeys.serumBids,
    serumAsks: raydiumAmm.serumMarketKeys.serumAsks,
    serumEventQueue: raydiumAmm.serumMarketKeys.serumEventQueue,
    serumCoinVaultAccount: raydiumAmm.serumMarketKeys.serumCoinVaultAccount,
    serumPcVaultAccount: raydiumAmm.serumMarketKeys.serumPcVaultAccount,
    serumVaultSigner: raydiumAmm.serumMarketKeys.serumVaultSigner,
    userSourceTokenAccount: userSourceTokenAccount,
    userDestinationTokenAccount: userDestinationTokenAccount,
    userSourceOwner: userTransferAuthority,
  };
}

function createRaydiumSwapInstruction({
  raydiumAmm,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps6;
  console.log(`inAmount: ${inAmount}, minimumOutAmount: ${minimumOutAmount}`);
  return JUPITER_PROGRAM.instruction.raydiumSwapV2(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps6 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps6 !== void 0
      ? _platformFee$feeBps6
      : 0,
    {
      accounts: raydiumAmmToRaydiumSwap(
        raydiumAmm,
        userSourceTokenAccount,
        userDestinationTokenAccount,
        userTransferAuthority
      ),
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

class RaydiumAmm {
  constructor(ammId, ammAccountInfo, params) {
    this.ammId = void 0;
    this.id = void 0;
    this.label = "Raydium";
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this.coinMint = void 0;
    this.pcMint = void 0;
    this.status = void 0;
    this.serumProgramId = void 0;
    this.serumMarket = void 0;
    this.ammOpenOrders = void 0;
    this.ammTargetOrders = void 0;
    this.poolCoinTokenAccount = void 0;
    this.poolPcTokenAccount = void 0;
    this.serumMarketKeys = void 0;
    this.coinReserve = void 0;
    this.pcReserve = void 0;
    this.feePct = void 0;
    this.calculator = void 0;
    this.ammId = ammId;
    this.id = ammId.toBase58();
    const decoded = AMM_INFO_LAYOUT_V4.decode(ammAccountInfo.data);
    this.status = decoded.status;
    this.coinMint = new web3.PublicKey(decoded.coinMintAddress);
    this.pcMint = new web3.PublicKey(decoded.pcMintAddress);
    this.poolCoinTokenAccount = new web3.PublicKey(
      decoded.poolCoinTokenAccount
    );
    this.poolPcTokenAccount = new web3.PublicKey(decoded.poolPcTokenAccount);
    this.serumProgramId = new web3.PublicKey(decoded.serumProgramId);
    this.serumMarket = new web3.PublicKey(decoded.serumMarket);
    this.ammOpenOrders = new web3.PublicKey(decoded.ammOpenOrders);
    this.ammTargetOrders = new web3.PublicKey(decoded.ammTargetOrders);
    this.serumMarketKeys = Object.keys(params).reduce((acc, item) => {
      const pk = params[item];
      if (!pk) throw new Error(`Could not find ${item} in params`);
      acc[item] = new web3.PublicKey(params[item]);
      return acc;
    }, {});
    const swapFeeNumerator = decoded.swapFeeNumerator;
    const swapFeeDenominator = decoded.swapFeeDenominator;
    this.feePct = new Decimal__default["default"](
      swapFeeNumerator.toString()
    ).div(swapFeeDenominator.toString());
    this.calculator = new math.TokenSwapConstantProduct(
      new math.Fraction(
        JSBI__default["default"].BigInt(swapFeeNumerator),
        JSBI__default["default"].BigInt(swapFeeDenominator)
      ),
      math.ZERO_FRACTION
    );
  }

  static decodeSerumMarketKeysString(
    serumProgramId,
    serumMarket,
    serumMarketInfo
  ) {
    const decodedMarket = serum.Market.getLayout(serumProgramId).decode(
      serumMarketInfo.data
    );
    const serumVaultSigner = web3.PublicKey.createProgramAddressSync(
      [
        serumMarket.toBuffer(),
        decodedMarket.vaultSignerNonce.toArrayLike(Buffer, "le", 8),
      ],
      serumProgramId
    );
    return {
      serumBids: decodedMarket.bids.toBase58(),
      serumAsks: decodedMarket.asks.toBase58(),
      serumEventQueue: decodedMarket.eventQueue.toBase58(),
      serumCoinVaultAccount: decodedMarket.baseVault.toBase58(),
      serumPcVaultAccount: decodedMarket.quoteVault.toBase58(),
      serumVaultSigner: serumVaultSigner.toBase58(),
    };
  }

  getAccountsForUpdate() {
    return [
      this.ammId,
      this.poolCoinTokenAccount,
      this.poolPcTokenAccount,
      this.ammOpenOrders,
    ];
  }

  update(accountInfoMap) {
    const [
      ammAccountInfo,
      poolCoinTokenAccountInfo,
      poolPcTokenAccountInfo,
      ammOpenOrdersAccountInfo,
    ] = mapAddressToAccountInfos(accountInfoMap, this.getAccountsForUpdate());
    const [coinAmount, pcAmount] = [
      RaydiumAmm.tokenAmountAccessor(poolCoinTokenAccountInfo),
      RaydiumAmm.tokenAmountAccessor(poolPcTokenAccountInfo),
    ];
    const openOrders = serum.OpenOrders.fromAccountInfo(
      this.ammOpenOrders,
      ammOpenOrdersAccountInfo,
      ammOpenOrdersAccountInfo.owner
    );
    const decoded = AMM_INFO_LAYOUT_V4.decode(ammAccountInfo.data);
    this.coinReserve = coinAmount
      .add(openOrders.baseTokenTotal)
      .sub(new splToken.u64(String(decoded.needTakePnlCoin)));
    this.pcReserve = pcAmount
      .add(openOrders.quoteTokenTotal)
      .sub(new splToken.u64(String(decoded.needTakePnlPc)));
  }

  static tokenAmountAccessor(tokenAccountInfo) {
    return splToken.u64.fromBuffer(tokenAccountInfo.data.slice(64, 64 + 8));
  }

  getQuote({ sourceMint, amount }) {
    const { coinReserve, pcReserve } = this;

    if (!coinReserve || !pcReserve) {
      throw new Error("Pool token accounts balances not refreshed or empty");
    }

    const outputIndex = this.coinMint.equals(sourceMint) ? 1 : 0;
    const result = this.calculator.exchange(
      [
        JSBI__default["default"].BigInt(coinReserve),
        JSBI__default["default"].BigInt(pcReserve),
      ],
      JSBI__default["default"].BigInt(amount),
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
    return [
      createRaydiumSwapInstruction({
        raydiumAmm: this,
        ...swapParams,
        inAmount: swapParams.amount,
        minimumOutAmount: swapParams.otherAmountThreshold,
      }),
    ];
  }

  get reserveTokenMints() {
    return [this.coinMint, this.pcMint];
  }
}

module.exports = {
  RaydiumAmm,
};

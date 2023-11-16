const bufferLayout = require("@solana/buffer-layout");
const splToken = require("@solana/spl-token");
const web3 = require("@solana/web3.js");

class PublicKeyLayout extends bufferLayout.Layout {
  constructor(property) {
    const layout = bufferLayout.blob(32);
    super(layout.span, property);
    this.layout = void 0;
    this.layout = layout;
  }

  getSpan(b, offset) {
    return this.layout.getSpan(b, offset);
  }

  decode(b, offset) {
    return new web3.PublicKey(this.layout.decode(b, offset));
  }

  encode(src, b, offset) {
    return this.layout.encode(src.toBuffer(), b, offset);
  }
}

class U64Layout extends bufferLayout.Layout {
  constructor(span = 8, property) {
    const layout = bufferLayout.blob(span);
    super(layout.span, property);
    this.layout = void 0;
    this.layout = layout;
  }

  getSpan(b, offset) {
    return this.layout.getSpan(b, offset);
  }

  decode(b, offset) {
    const bn = new splToken.u64(this.layout.decode(b, offset), 10, "le");
    return bn;
  }

  encode(src, b, offset) {
    return this.layout.encode(
      src.toArrayLike(Buffer, "le", this.layout.span),
      b,
      offset
    );
  }
}

const publicKey = (property) => new PublicKeyLayout(property);
const uint64 = (property) => new U64Layout(8, property);
const uint128 = (property) => new U64Layout(16, property);

const SenchaSwapLayout = bufferLayout.struct([
  bufferLayout.blob(8, "discriminator"),
  publicKey("factory"),
  bufferLayout.u8("bump"),
  uint64("index"),
  publicKey("admin"),
  publicKey("token0Reserves"),
  publicKey("token0Mint"),
  publicKey("token0Fees"),
  publicKey("token1Reserves"),
  publicKey("token1Mint"),
  publicKey("token1Fees"),
  bufferLayout.u8("isPaused"),
  publicKey("poolMint"),
  uint64("tradeFeeKbps"),
  uint64("withdrawFeeKbps"),
  uint64("adminTradeFeeKbps"),
  uint64("adminWithdrawFeeKbps"),
]);

const CropperTokenSwapLayout = bufferLayout.struct([
  bufferLayout.u8("version"),
  bufferLayout.u8("isInitialized"),
  bufferLayout.u8("nonce"),
  publicKey("ammId"),
  publicKey("serumProgramId"),
  publicKey("serumMarket"),
  publicKey("tokenProgramId"),
  publicKey("tokenAAccount"),
  publicKey("tokenBAccount"),
  publicKey("poolMint"),
  publicKey("mintA"),
  publicKey("mintB"),
]);

const CropperStateLayout = bufferLayout.struct([
  bufferLayout.u8("isInitialized"),
  publicKey("stateOwner"),
  publicKey("feeOwner"),
  uint64("initialSupply"),
  uint64("returnFeeNumerator"),
  uint64("fixedFeeNumerator"),
  uint64("feeDenominator"),
  bufferLayout.u8("curveType"),
  bufferLayout.blob(32, "curveParameters"),
]);

const FEES_LAYOUT = bufferLayout.struct(
  [
    uint64("tradeFeeNumerator"),
    uint64("tradeFeeDenominator"),
    uint64("ownerTradeFeeNumerator"),
    uint64("ownerTradeFeeDenominator"),
    uint64("ownerWithdrawFeeNumerator"),
    uint64("ownerWithdrawFeeDenominator"),
  ],
  "fees"
);

const POOL_FIELDS_COMMON = [
  bufferLayout.blob(8, "padding"),
  publicKey("lpTokenFreezeVault"),
  publicKey("poolMint"),
  publicKey("baseTokenVault"),
  publicKey("baseTokenMint"),
  publicKey("quoteTokenVault"),
  publicKey("quoteTokenMint"),
  publicKey("poolSigner"),
  bufferLayout.u8("poolSignerNonce"),
  publicKey("authority"),
  publicKey("initializerAccount"),
  publicKey("feeBaseAccount"),
  publicKey("feeQuoteAccount"),
  publicKey("feePoolTokenAccount"),
  FEES_LAYOUT,
];

const TokenSwapLayout = bufferLayout.struct([
  bufferLayout.u8("version"),
  bufferLayout.u8("isInitialized"),
  bufferLayout.u8("bumpSeed"),
  publicKey("tokenProgramId"),
  publicKey("tokenAccountA"),
  publicKey("tokenAccountB"),
  publicKey("tokenPool"),
  publicKey("mintA"),
  publicKey("mintB"),
  publicKey("feeAccount"),
  uint64("tradeFeeNumerator"),
  uint64("tradeFeeDenominator"),
  uint64("ownerTradeFeeNumerator"),
  uint64("ownerTradeFeeDenominator"),
  uint64("ownerWithdrawFeeNumerator"),
  uint64("ownerWithdrawFeeDenominator"),
  uint64("hostFeeNumerator"),
  uint64("hostFeeDenominator"),
  bufferLayout.u8("curveType"),
  bufferLayout.blob(32, "curveParameters"),
]);

const StepTokenSwapLayout = bufferLayout.struct([
  bufferLayout.u8("version"),
  bufferLayout.u8("isInitialized"),
  bufferLayout.u8("bumpSeed"),
  publicKey("tokenProgramId"),
  publicKey("tokenAccountA"),
  publicKey("tokenAccountB"),
  publicKey("tokenPool"),
  publicKey("mintA"),
  publicKey("mintB"),
  publicKey("feeAccount"),
  uint64("tradeFeeNumerator"),
  uint64("tradeFeeDenominator"),
  uint64("ownerTradeFeeNumerator"),
  uint64("ownerTradeFeeDenominator"),
  uint64("ownerWithdrawFeeNumerator"),
  uint64("ownerWithdrawFeeDenominator"),
  bufferLayout.u8("curveType"),
  bufferLayout.blob(32, "curveParameters"),
  bufferLayout.u8("poolNonce"),
]);

const POOL_LAYOUT = bufferLayout.struct(POOL_FIELDS_COMMON);

const POOL_V2_LAYOUT = bufferLayout.struct([
  ...POOL_FIELDS_COMMON,
  bufferLayout.u8("curveType"),
  publicKey("curve"),
]);

const STABLE_CURVE_LAYOUT = bufferLayout.struct([
  bufferLayout.blob(8, "padding"),
  uint64("amp"),
]);

const AMM_INFO_LAYOUT_V4 = bufferLayout.struct([
  bufferLayout.nu64("status"),
  bufferLayout.nu64("nonce"),
  bufferLayout.nu64("orderNum"),
  bufferLayout.nu64("depth"),
  bufferLayout.nu64("coinDecimals"),
  bufferLayout.nu64("pcDecimals"),
  bufferLayout.nu64("state"),
  bufferLayout.nu64("resetFlag"),
  bufferLayout.nu64("minSize"),
  bufferLayout.nu64("volMaxCutRatio"),
  bufferLayout.nu64("amountWaveRatio"),
  bufferLayout.nu64("coinLotSize"),
  bufferLayout.nu64("pcLotSize"),
  bufferLayout.nu64("minPriceMultiplier"),
  bufferLayout.nu64("maxPriceMultiplier"),
  bufferLayout.nu64("systemDecimalsValue"),

  // Fees
  bufferLayout.nu64("minSeparateNumerator"),
  bufferLayout.nu64("minSeparateDenominator"),
  bufferLayout.nu64("tradeFeeNumerator"),
  bufferLayout.nu64("tradeFeeDenominator"),
  bufferLayout.nu64("pnlNumerator"),
  bufferLayout.nu64("pnlDenominator"),
  bufferLayout.nu64("swapFeeNumerator"),
  bufferLayout.nu64("swapFeeDenominator"),

  // OutPutData
  bufferLayout.nu64("needTakePnlCoin"),
  bufferLayout.nu64("needTakePnlPc"),
  bufferLayout.nu64("totalPnlPc"),
  bufferLayout.nu64("totalPnlCoin"),
  uint128("poolTotalDepositPc"),
  uint128("poolTotalDepositCoin"),
  uint128("swapCoinInAmount"),
  uint128("swapPcOutAmount"),
  bufferLayout.nu64("swapCoin2PcFee"),
  uint128("swapPcInAmount"),
  uint128("swapCoinOutAmount"),
  bufferLayout.nu64("swapPc2CoinFee"),
  publicKey("poolCoinTokenAccount"),
  publicKey("poolPcTokenAccount"),
  publicKey("coinMintAddress"),
  publicKey("pcMintAddress"),
  publicKey("lpMintAddress"),
  publicKey("ammOpenOrders"),
  publicKey("serumMarket"),
  publicKey("serumProgramId"),
  publicKey("ammTargetOrders"),
  publicKey("poolWithdrawQueue"),
  publicKey("poolTempLpTokenAccount"),
  publicKey("ammOwner"),
  publicKey("pnlOwner"),
]);

const MercurialSwapLayout = bufferLayout.struct([
  bufferLayout.u8("version"),
  bufferLayout.u8("isInitialized"),
  bufferLayout.u8("nonce"),
  uint64("amplificationCoefficient"),
  uint64("feeNumerator"),
  uint64("adminFeeNumerator"),
  bufferLayout.u32("tokenAccountsLength"),
  uint64("precisionFactor"),
  uint64("precisionMultiplierA"),
  uint64("precisionMultiplierB"),
  uint64("precisionMultiplierC"),
  uint64("precisionMultiplierD"),
  publicKey("tokenAccountA"),
  publicKey("tokenAccountB"),
  publicKey("tokenAccountC"),
  publicKey("tokenAccountD"),
]);

module.exports = {
  SenchaSwapLayout,
  CropperTokenSwapLayout,
  CropperStateLayout,
  FEES_LAYOUT,
  POOL_FIELDS_COMMON,
  TokenSwapLayout,
  StepTokenSwapLayout,
  POOL_LAYOUT,
  POOL_V2_LAYOUT,
  STABLE_CURVE_LAYOUT,
  AMM_INFO_LAYOUT_V4,
  MercurialSwapLayout,
};

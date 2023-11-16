const splToken = require("@solana/spl-token");
const web3 = require("@solana/web3.js");
const serum = require('@project-serum/serum');

const { JUPITER_PROGRAM } = require("../jupiter");

const {
  prepareRemainingAccounts,
  mapAddressToAccountInfos,
  getOutAmountMeta,
  getL2,
} = require("./utils");

const Side = {
  Bid: {
    bid: {},
  },
  Ask: {
    ask: {},
  },
};

function marketIntoSerumSwap(
  market,
  openOrdersAddress,
  orderPayerTokenAccountAddress,
  coinWallet,
  pcWallet,
  userTransferAuthority
) {
  const vaultSigner = web3.PublicKey.createProgramAddressSync(
    [
      market.address.toBuffer(),
      market.decoded.vaultSignerNonce.toArrayLike(Buffer, "le", 8),
    ],
    market.programId
  );
  return {
    market: {
      market: market.address,
      openOrders: openOrdersAddress,
      requestQueue: market.decoded.requestQueue,
      eventQueue: market.decoded.eventQueue,
      bids: market.bidsAddress,
      asks: market.asksAddress,
      coinVault: market.decoded.baseVault,
      pcVault: market.decoded.quoteVault,
      vaultSigner,
    },
    authority: userTransferAuthority,
    orderPayerTokenAccount: orderPayerTokenAccountAddress,
    coinWallet,
    pcWallet,
    // Programs.
    dexProgram: market.programId,
    tokenProgram: splToken.TOKEN_PROGRAM_ID,
    // Sysvars.
    rent: web3.SYSVAR_RENT_PUBKEY,
  };
}

function createSerumSwapInstruction({
  market,
  sourceMint,
  openOrdersAddress,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
  referrer,
}) {
  var _platformFee$feeBps2;
  const { side, coinWallet, pcWallet } = sourceMint.equals(
    market.baseMintAddress
  )
    ? {
        side: Side.Ask,
        coinWallet: userSourceTokenAccount,
        pcWallet: userDestinationTokenAccount,
      }
    : {
        side: Side.Bid,
        coinWallet: userDestinationTokenAccount,
        pcWallet: userSourceTokenAccount,
      };
  let remainingAccounts = prepareRemainingAccounts(
    inAmount,
    tokenLedger,
    platformFee === null || platformFee === void 0
      ? void 0
      : platformFee.feeAccount
  );

  if (referrer) {
    remainingAccounts.push({
      pubkey: referrer,
      isSigner: false,
      isWritable: true,
    });
  }

  return JUPITER_PROGRAM.instruction.serumSwap(
    side,
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps2 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps2 !== void 0
      ? _platformFee$feeBps2
      : 0,
    {
      accounts: marketIntoSerumSwap(
        market,
        openOrdersAddress,
        userSourceTokenAccount,
        coinWallet,
        pcWallet,
        userTransferAuthority
      ),
      remainingAccounts,
    }
  );
}

class SerumAmm {
  constructor(market) {
    this.market = void 0;
    this.id = void 0;
    this.label = "Serum";
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this._orderbooks = void 0;
    this.market = market;
    this.id = market.address.toBase58();
  }

  get orderbooks() {
    return this._orderbooks;
  }

  getAccountsForUpdate() {
    return [this.market.asksAddress, this.market.bidsAddress];
  }

  update(accountInfoMap) {
    const [asksAccountInfo, bidsAccountInfo] = mapAddressToAccountInfos(
      accountInfoMap,
      this.getAccountsForUpdate()
    );
    const asks = serum.Orderbook.decode(this.market, asksAccountInfo.data);
    const bids = serum.Orderbook.decode(this.market, bidsAccountInfo.data);
    this._orderbooks = {
      asks,
      bids,
    };
  }

  getQuote({ sourceMint, destinationMint, amount }) {
    if (!this.orderbooks) {
      throw new Error("Failed to find orderbooks");
    }

    const outAmountMeta = getOutAmountMeta({
      market: this.market,
      asks: this.orderbooks.asks,
      bids: this.orderbooks.bids,
      fromMint: sourceMint,
      toMint: destinationMint,
      fromAmount: amount,
    });
    return {
      notEnoughLiquidity: outAmountMeta.notEnoughLiquidity,
      minInAmount: outAmountMeta.minimum.in,
      minOutAmount: outAmountMeta.minimum.out,
      inAmount: outAmountMeta.inAmount,
      outAmount: outAmountMeta.outAmount,
      feeAmount: outAmountMeta.feeAmount,
      feeMint: this.market.quoteMintAddress.toBase58(),
      feePct: outAmountMeta.feePct,
      priceImpactPct: outAmountMeta.priceImpactPct,
    };
  }

  createSwapInstructions(swapParams) {
    var _swapParams$quoteMint;

    if (!swapParams.openOrdersAddress) {
      throw new Error("Missing open orders");
    }

    return [
      createSerumSwapInstruction({
        market: this.market,
        openOrdersAddress: swapParams.openOrdersAddress,
        referrer:
          swapParams === null || swapParams === void 0
            ? void 0
            : (_swapParams$quoteMint = swapParams.quoteMintToReferrer) ===
                null || _swapParams$quoteMint === void 0
            ? void 0
            : _swapParams$quoteMint.get(
                this.market.quoteMintAddress.toBase58()
              ),
        ...swapParams,
        inAmount: swapParams.amount,
        minimumOutAmount: swapParams.otherAmountThreshold,
      }),
    ];
  }

  get reserveTokenMints() {
    return [this.market.baseMintAddress, this.market.quoteMintAddress];
  }
}

SerumAmm.getL2 = getL2;

module.exports = {
  SerumAmm,
};

const splToken = require("@solana/spl-token");
const web3 = require("@solana/web3.js");
const math = require("@jup-ag/math");
const optimist = require("@mercurial-finance/optimist");

const { MERCURIAL_SWAP_PROGRAM_ID } = require("./constants");
const { MercurialSwapLayout } = require("./layouts");
const { JUPITER_PROGRAM } = require("../jupiter");
const {
  prepareRemainingAccounts,
  mapAddressToAccountInfos,
  JSBI__default,
  tokenAccountsToJSBIs,
} = require("./utils");

const FEE_DENOMINATOR$1 = Math.pow(10, 10);

const accountInfoToMercurialSwapLayout = (address, accountInfo) => {
  const programId = accountInfo.owner;
  const decoded = MercurialSwapLayout.decode(accountInfo.data);
  const tokenAccountsLength = decoded.tokenAccountsLength;
  const [authority] = web3.PublicKey.findProgramAddressSync(
    [address.toBuffer()],
    programId
  );
  const precisionMultipliers = [
    decoded.precisionMultiplierA.toNumber(),
    decoded.precisionMultiplierB.toNumber(),
    decoded.precisionMultiplierC.toNumber(),
    decoded.precisionMultiplierD.toNumber(),
  ].slice(0, tokenAccountsLength);
  const tokenAccounts = [
    decoded.tokenAccountA,
    decoded.tokenAccountB,
    decoded.tokenAccountC,
    decoded.tokenAccountD,
  ].slice(0, tokenAccountsLength);
  return {
    programId,
    authority,
    isInitialized: Boolean(decoded.isInitialized),
    nonce: decoded.nonce,
    ammId: address,
    amplificationCoefficient: decoded.amplificationCoefficient.toNumber(),
    feeNumerator: decoded.feeNumerator.toNumber(),
    tokenAccountsLength,
    precisionFactor: decoded.precisionFactor.toNumber(),
    precisionMultipliers,
    tokenAccounts,
  };
};

function stableSwapNPoolIntoMercurialExchange(
  swayLayout,
  sourceTokenAccount,
  destinationTokenAccount,
  userTransferAuthority
) {
  return {
    swapProgram: MERCURIAL_SWAP_PROGRAM_ID,
    swapState: swayLayout.ammId,
    tokenProgram: splToken.TOKEN_PROGRAM_ID,
    poolAuthority: swayLayout.authority,
    userTransferAuthority: userTransferAuthority,
    sourceTokenAccount,
    destinationTokenAccount,
  };
}

function createMercurialExchangeInstruction({
  swapLayout,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps;

  const remainingAccounts = [];

  for (const swapTokenAccount of swapLayout.tokenAccounts) {
    remainingAccounts.push({
      pubkey: swapTokenAccount,
      isSigner: false,
      isWritable: true,
    });
  }

  remainingAccounts.push(
    ...prepareRemainingAccounts(
      inAmount,
      tokenLedger,
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeAccount
    )
  );
  return JUPITER_PROGRAM.instruction.mercurialExchange(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps !== void 0
      ? _platformFee$feeBps
      : 0,
    {
      accounts: stableSwapNPoolIntoMercurialExchange(
        swapLayout,
        userSourceTokenAccount,
        userDestinationTokenAccount,
        userTransferAuthority
      ),
      remainingAccounts,
    }
  );
}

class MercurialAmm {
  constructor(address, accountInfo, params) {
    this.params = void 0;
    this.id = void 0;
    this.label = "Mercurial";
    this.shouldPrefetch = false;
    this.exactOutputSupported = false;
    this.swapLayout = void 0;
    this.tokenAccounts = [];
    this.calculator = void 0;
    this.params = params;
    this.id = address.toBase58();
    this.swapLayout = accountInfoToMercurialSwapLayout(address, accountInfo);
    this.calculator = new math.Stable(
      JSBI__default["default"].BigInt(this.swapLayout.tokenAccountsLength),
      JSBI__default["default"].BigInt(this.swapLayout.amplificationCoefficient),
      this.swapLayout.precisionMultipliers.map((precisionMultiplier) =>
        JSBI__default["default"].BigInt(precisionMultiplier)
      ),
      new math.Fraction(
        JSBI__default["default"].BigInt(this.swapLayout.feeNumerator),
        JSBI__default["default"].BigInt(FEE_DENOMINATOR$1)
      )
    );
  }

  getAccountsForUpdate() {
    return this.swapLayout.tokenAccounts;
  }

  update(accountInfoMap) {
    let tokenAccountInfos = mapAddressToAccountInfos(
      accountInfoMap,
      this.getAccountsForUpdate()
    );
    this.tokenAccounts = tokenAccountInfos
      .map((info) => optimist.deserializeAccount(info.data))
      .filter((x) => x !== null);
  }

  getQuote({ sourceMint, destinationMint, amount }) {
    if (this.tokenAccounts.length === 0) {
      throw new Error("Unable to fetch accounts for specified tokens.");
    }

    const inputIndex = this.tokenAccounts.findIndex((tokenAccount) =>
      tokenAccount.mint.equals(sourceMint)
    );
    const outputIndex = this.tokenAccounts.findIndex((tokenAccount) =>
      tokenAccount.mint.equals(destinationMint)
    );
    const result = this.calculator.exchange(
      tokenAccountsToJSBIs(this.tokenAccounts),
      JSBI__default["default"].BigInt(amount),
      inputIndex,
      outputIndex
    );
    const feePct = this.swapLayout.feeNumerator / FEE_DENOMINATOR$1;
    return {
      notEnoughLiquidity: false,
      inAmount: amount,
      outAmount: result.expectedOutputAmount,
      feeAmount: result.fees,
      feeMint: destinationMint.toBase58(),
      feePct: feePct,
      priceImpactPct: result.priceImpact.toNumber(),
    };
  }

  createSwapInstructions(swapParams) {
    return [
      createMercurialExchangeInstruction({
        swapLayout: this.swapLayout,
        ...swapParams,
        inAmount: swapParams.amount,
        minimumOutAmount: swapParams.otherAmountThreshold,
      }),
    ];
  }

  get reserveTokenMints() {
    return this.params.tokenMints.map(
      (tokenMint) => new web3.PublicKey(tokenMint)
    );
  }
}

MercurialAmm.decodeSwapLayout = accountInfoToMercurialSwapLayout;

module.exports = {
  MercurialAmm,
};

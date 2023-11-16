const anchor = require("@project-serum/anchor");
const splToken = require("@solana/spl-token");
const optimist = require("@mercurial-finance/optimist");
const web3 = require("@solana/web3.js");

const { JUPITER_PROGRAM } = require("../jupiter");
const mariande = require("./MarinadeIdl");
const { JUPITER_PROGRAM_ID, MARINADE_PROGRAM_ID } = require("./constants");
const {
  prepareRemainingAccounts,
  mapAddressToAccountInfos,
  JSBI__default,
  BN__default,
} = require("./utils");

function saturatingSub(left, right) {
  return left.gt(right) ? left.sub(right) : new BN__default["default"](0);
}
/**
 * Returns `amount` * `numerator` / `denominator`.
 * BN library we use does not handle fractions, so the value is `floored`
 *
 * @param {BN} amount
 * @param {BN} numerator
 * @param {BN} denominator
 */

function proportionalBN(amount, numerator, denominator) {
  if (denominator.isZero()) {
    return amount;
  }

  return amount.mul(numerator).div(denominator);
}

function unstakeNowFeeBp(
  lpMinFeeBasisPoints,
  lpMaxFeeBasisPoints,
  lpLiquidityTarget,
  lamportsAvailable,
  lamportsToObtain
) {
  // if trying to get more than existing
  if (lamportsToObtain.gte(lamportsAvailable)) {
    return lpMaxFeeBasisPoints;
  } // result after operation

  const lamportsAfter = lamportsAvailable.sub(lamportsToObtain); // if GTE target => min fee

  if (lamportsAfter.gte(lpLiquidityTarget)) {
    return lpMinFeeBasisPoints;
  } else {
    const delta = lpMaxFeeBasisPoints - lpMinFeeBasisPoints;
    return (
      lpMaxFeeBasisPoints -
      proportionalBN(
        new BN__default["default"](delta),
        lamportsAfter,
        lpLiquidityTarget
      ).toNumber()
    );
  }
}

function valueFromShares(shares, totalValue, totalShares) {
  return proportionalBN(shares, totalValue, totalShares);
}

function sharesFromValue(value, totalValue, totalShares) {
  return totalShares.eq(new BN__default["default"](0))
    ? value
    : proportionalBN(value, totalShares, totalValue);
}

class MarinadeState {
  constructor(state, liqPoolSolLegPdaLamports, liqPoolMSOLLegAmount) {
    this.state = void 0;
    this.liqPoolSolLegPdaLamports = void 0;
    this.liqPoolMSOLLegAmount = void 0;
    this.state = state;
    this.liqPoolSolLegPdaLamports = liqPoolSolLegPdaLamports;
    this.liqPoolMSOLLegAmount = liqPoolMSOLLegAmount;
  } // https://github.com/marinade-finance/liquid-staking-program/blob/main/programs/marinade-finance/src/state/deposit.rs#L61-L170

  depositQuote(lamports) {
    let userLamports = lamports;
    const userMSOLBuyOrder = this.calcMSOLFromLamports(userLamports);
    const swapMSOLMax = BN__default["default"].min(
      userMSOLBuyOrder,
      this.liqPoolMSOLLegAmount
    );
    let outAmountBN = new BN__default["default"](0); // if we can sell from the LiqPool

    userLamports = (() => {
      if (swapMSOLMax.gt(new BN__default["default"](0))) {
        const lamportsForTheLiqPool = userMSOLBuyOrder.eq(swapMSOLMax)
          ? userLamports
          : this.calcLamportsFromMSOLAmount(swapMSOLMax); // transfered mSOL to the user

        outAmountBN = outAmountBN.add(swapMSOLMax);
        return saturatingSub(userLamports, lamportsForTheLiqPool);
      } else {
        return userLamports;
      }
    })(); // check if we have more lamports from the user

    if (userLamports.gt(new BN__default["default"](0))) {
      this.checkStakingCap(userLamports);
      const MSOLToMint = this.calcMSOLFromLamports(userLamports);
      outAmountBN = outAmountBN.add(MSOLToMint);
    }

    return {
      outAmount: outAmountBN,
      feeAmount: 0,
      feePct: 0,
      priceImpactPct: 0,
    };
  }

  checkStakingCap(transferingLamports) {
    const resultAmount =
      this.totalLamportsUnderControl().add(transferingLamports);
    if (resultAmount.gt(this.state.stakingSolCap))
      throw new Error("Staking cap reached");
  }

  calcMSOLFromLamports(stakeLamports) {
    return sharesFromValue(
      stakeLamports,
      this.totalVirtualStakedLamports(),
      this.state.msolSupply
    );
  }

  calcLamportsFromMSOLAmount(msolAmount) {
    return valueFromShares(
      msolAmount,
      this.totalVirtualStakedLamports(),
      this.state.msolSupply
    );
  }

  totalVirtualStakedLamports() {
    return saturatingSub(
      this.totalLamportsUnderControl(),
      this.state.circulatingTicketBalance
    );
  }

  totalLamportsUnderControl() {
    return this.state.validatorSystem.totalActiveBalance
      .add(this.totalCoolingDown())
      .add(this.state.availableReserveBalance);
  }

  totalCoolingDown() {
    return this.state.stakeSystem.delayedUnstakeCoolingDown.add(
      this.state.emergencyCoolingDown
    );
  } // https://github.com/marinade-finance/liquid-staking-program/blob/main/programs/marinade-finance/src/state/liquid_unstake.rs#L68-L171

  liquidUnstakeQuote(msolAmount) {
    const maxLamports = saturatingSub(
      this.liqPoolSolLegPdaLamports,
      this.state.rentExemptForTokenAcc
    );
    const lamportsToObtain = this.calcLamportsFromMSOLAmount(msolAmount);
    const liquidUnstakeFeeBp = unstakeNowFeeBp(
      this.state.liqPool.lpMinFee.basisPoints,
      this.state.liqPool.lpMaxFee.basisPoints,
      this.state.liqPool.lpLiquidityTarget,
      maxLamports,
      lamportsToObtain
    );
    const msolFee = msolAmount
      .mul(new BN__default["default"](liquidUnstakeFeeBp))
      .div(new BN__default["default"](10000));
    const workingLamportsValue = this.calcLamportsFromMSOLAmount(
      msolAmount.sub(msolFee)
    );
    if (
      workingLamportsValue
        .add(this.state.rentExemptForTokenAcc)
        .gt(this.liqPoolSolLegPdaLamports)
    )
      throw new Error("Insufficient liquidity");
    return {
      outAmount: workingLamportsValue,
      feeAmount: msolFee,
      feePct: liquidUnstakeFeeBp / 10000,
      priceImpactPct: 0,
    };
  }
}

function createMarinadeFinanceDepositInstruction({
  additionalArgs,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps17;

  const transferFrom = userTransferAuthority;
  const tempWsolTokenAccount = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("temp-wsol-token-account"), transferFrom.toBuffer()],
    JUPITER_PROGRAM_ID
  )[0];
  const tempSolPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("temp-sol-pda"), userTransferAuthority.toBuffer()],
    JUPITER_PROGRAM_ID
  )[0];
  return JUPITER_PROGRAM.instruction.marinadeFinanceDeposit(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps17 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps17 !== void 0
      ? _platformFee$feeBps17
      : 0,
    {
      accounts: {
        marinadeFinanceProgram: MARINADE_PROGRAM_ID,
        state: additionalArgs.address,
        userTransferAuthority,
        msolMint: additionalArgs.marinadeStateResponse.msolMint,
        liqPoolSolLegPda: additionalArgs.liqPoolSolLegPda,
        liqPoolMsolLeg: additionalArgs.marinadeStateResponse.liqPool.msolLeg,
        liqPoolMsolLegAuthority: additionalArgs.liqPoolMsolLegAuthority,
        reservePda: additionalArgs.reservePda,
        transferFrom: tempSolPda,
        mintTo: userDestinationTokenAccount,
        msolMintAuthority: additionalArgs.msolMintAuthority,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        userWsolTokenAccount: userSourceTokenAccount,
        tempWsolTokenAccount,
        wsolMint: splToken.NATIVE_MINT,
        rent: web3.SYSVAR_RENT_PUBKEY,
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

function createMarinadeFinanceLiquidUnstakeInstruction({
  additionalArgs,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps18;

  const tempSolPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("temp-sol-pda"), userTransferAuthority.toBuffer()],
    JUPITER_PROGRAM_ID
  )[0];
  return JUPITER_PROGRAM.instruction.marinadeFinanceLiquidUnstake(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps18 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps18 !== void 0
      ? _platformFee$feeBps18
      : 0,
    {
      accounts: {
        marinadeFinanceProgram: MARINADE_PROGRAM_ID,
        state: additionalArgs.address,
        msolMint: additionalArgs.marinadeStateResponse.msolMint,
        liqPoolSolLegPda: additionalArgs.liqPoolSolLegPda,
        liqPoolMsolLeg: additionalArgs.marinadeStateResponse.liqPool.msolLeg,
        treasuryMsolAccount:
          additionalArgs.marinadeStateResponse.treasuryMsolAccount,
        getMsolFrom: userSourceTokenAccount,
        getMsolFromAuthority: userTransferAuthority,
        transferSolTo: tempSolPda,
        systemProgram: web3_js.SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        userWsolTokenAccount: userDestinationTokenAccount,
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
class MarinadeAmm {
  // Pricing is very state dependent and using stale data will lead to a stale quote
  constructor(address, accountInfo) {
    this.address = void 0;
    this.id = void 0;
    this.label = "Marinade";
    this.shouldPrefetch = true;
    this.exactOutputSupported = false;
    this.marinadeFinanceProgram = void 0;
    this.marinadeStateResponse = void 0;
    this.liqPoolSolLegPdaAddress = void 0;
    this.marinadeState = void 0;
    this.id = address.toBase58();
    this.marinadeFinanceProgram = new anchor.Program(
      mariande.marinadeFinanceIdlSchema,
      MARINADE_PROGRAM_ID,
      {}
    );
    this.marinadeStateResponse =
      this.marinadeFinanceProgram.coder.accounts.decode(
        "State",
        accountInfo.data
      );
    this.address = address;
    this.liqPoolSolLegPdaAddress = this.findProgramDerivedAddress(
      "liq_sol"
      /* ProgramDerivedAddressSeed.LIQ_POOL_SOL_ACCOUNT */
    );
  }

  getAccountsForUpdate() {
    return [
      this.address,
      this.liqPoolSolLegPdaAddress,
      this.marinadeStateResponse.liqPool.msolLeg,
    ];
  }

  update(accountInfoMap) {
    const [stateAccountInfo, liqPoolSolLegPda, liqPoolMSOLLegAccountInfo] =
      mapAddressToAccountInfos(accountInfoMap, this.getAccountsForUpdate());
    this.marinadeStateResponse =
      this.marinadeFinanceProgram.coder.accounts.decode(
        "State",
        stateAccountInfo.data
      );
    const liqPoolMSOLLeg = optimist.deserializeAccount(
      liqPoolMSOLLegAccountInfo.data
    );
    if (!liqPoolMSOLLeg)
      throw new Error(
        `liqPoolMSOLLeg token account cannot be deserialized ${this.marinadeStateResponse.liqPool.msolLeg.toBase58()}`
      );
    this.marinadeState = new MarinadeState(
      this.marinadeStateResponse,
      new BN__default["default"](liqPoolSolLegPda.lamports),
      liqPoolMSOLLeg.amount
    );
  }

  getQuote({ sourceMint, amount }) {
    if (!this.marinadeState)
      throw new Error("Update was not run to create a complete marinadeState");
    const amountBN = new BN__default["default"](amount.toString());
    const result = sourceMint.equals(splToken.NATIVE_MINT)
      ? this.marinadeState.depositQuote(amountBN)
      : this.marinadeState.liquidUnstakeQuote(amountBN);
    return {
      notEnoughLiquidity: false,
      inAmount: amount,
      outAmount: JSBI__default["default"].BigInt(result.outAmount.toString()),
      feeAmount: JSBI__default["default"].BigInt(result.feeAmount.toString()),
      feeMint: this.marinadeStateResponse.msolMint.toBase58(),
      feePct: result.feePct,
      priceImpactPct: 0,
    };
  }

  createSwapInstructions(swapParams) {
    return [
      swapParams.sourceMint.equals(splToken.NATIVE_MINT)
        ? createMarinadeFinanceDepositInstruction({
            additionalArgs: {
              address: this.address,
              marinadeStateResponse: this.marinadeStateResponse,
              liqPoolSolLegPda: this.liqPoolSolLegPdaAddress,
              liqPoolMsolLegAuthority: this.findProgramDerivedAddress(
                "liq_st_sol_authority"
                /* ProgramDerivedAddressSeed.LIQ_POOL_MSOL_AUTHORITY */
              ),
              reservePda: this.findProgramDerivedAddress(
                "reserve"
                /* ProgramDerivedAddressSeed.RESERVE_ACCOUNT */
              ),
              msolMintAuthority: this.findProgramDerivedAddress(
                "st_mint"
                /* ProgramDerivedAddressSeed.LIQ_POOL_MSOL_MINT_AUTHORITY */
              ),
            },
            inAmount: swapParams.amount,
            minimumOutAmount: swapParams.otherAmountThreshold,
            ...swapParams,
          })
        : createMarinadeFinanceLiquidUnstakeInstruction({
            additionalArgs: {
              address: this.address,
              marinadeStateResponse: this.marinadeStateResponse,
              liqPoolSolLegPda: this.liqPoolSolLegPdaAddress,
            },
            inAmount: swapParams.amount,
            minimumOutAmount: swapParams.otherAmountThreshold,
            ...swapParams,
          }),
    ];
  }

  get reserveTokenMints() {
    return [splToken.NATIVE_MINT, this.marinadeStateResponse.msolMint];
  }

  findProgramDerivedAddress(seed, extraSeeds = []) {
    const seeds = [this.address.toBuffer(), Buffer.from(seed), ...extraSeeds];
    const [result] = web3.PublicKey.findProgramAddressSync(
      seeds,
      this.marinadeFinanceProgram.programId
    );
    return result;
  }
}

module.exports = {
  MarinadeAmm,
};

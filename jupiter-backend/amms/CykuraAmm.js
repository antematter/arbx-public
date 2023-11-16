const anchor = require("@project-serum/anchor");
const splToken = require("@solana/spl-token");
const math = require("@jup-ag/math");
const web3 = require("@solana/web3.js");
const cykuraSdk = require("@jup-ag/cykura-sdk");
const cykuraSdkCore = require("@jup-ag/cykura-sdk-core");

const { JUPITER_PROGRAM } = require("../jupiter");
const { CYKURA_PROGRAM_ID } = require("./constants");
const {
  prepareRemainingAccounts,
  JSBI__default,
} = require("./utils");

const FEE_DENOMINATOR = JSBI__default["default"].BigInt(1000000);


const provider = new anchor.AnchorProvider(null, null, {
  skipPreflight: false,
});
const CYCLOS_CORE = new anchor.Program(
  cykuraSdk.IDL,
  CYKURA_PROGRAM_ID,
  provider
);

class SolanaTickDataProvider {
  constructor(program, pool) {
    this.program = void 0;
    this.pool = void 0;
    this.bitmapCache = void 0;
    this.tickCache = void 0;
    this.accountsToFetch = {
      bitmaps: [],
      ticks: [],
    };
    this.program = program;
    this.pool = pool;
    this.bitmapCache = new Map();
    this.tickCache = new Map();
  }
  /**
   * Caches ticks and bitmap accounts near the current price
   * @param tickCurrent The current pool tick
   * @param tickSpacing The pool tick spacing
   */

  async eagerLoadCache(tickCurrent, tickSpacing) {
    // fetch 10 bitmaps on each side in a single fetch. Find active ticks and read them together
    const compressed = JSBI__default["default"].toNumber(
      JSBI__default["default"].divide(
        JSBI__default["default"].BigInt(tickCurrent),
        JSBI__default["default"].BigInt(tickSpacing)
      )
    );
    const { wordPos } = cykuraSdk.tickPosition(compressed);

    try {
      const bitmapsToFetch = [];
      const { wordPos: WORD_POS_MIN } = cykuraSdk.tickPosition(
        Math.floor(cykuraSdk.TickMath.MIN_TICK / tickSpacing)
      );
      const { wordPos: WORD_POS_MAX } = cykuraSdk.tickPosition(
        Math.floor(cykuraSdk.TickMath.MAX_TICK / tickSpacing)
      );
      const minWord = Math.max(wordPos - 10, WORD_POS_MIN);
      const maxWord = Math.min(wordPos + 10, WORD_POS_MAX);

      for (let i = minWord; i < maxWord; i++) {
        bitmapsToFetch.push(this.getBitmapAddressSync(i));
      }

      const fetchedBitmaps =
        await this.program.account.tickBitmapState.fetchMultiple(
          bitmapsToFetch
        );
      const tickAddresses = [];

      for (let i = 0; i < maxWord - minWord; i++) {
        var _fetchedBitmaps$i;

        const currentWordPos = i + minWord;
        const wordArray =
          (_fetchedBitmaps$i = fetchedBitmaps[i]) === null ||
          _fetchedBitmaps$i === void 0
            ? void 0
            : _fetchedBitmaps$i.word;
        const word = wordArray
          ? cykuraSdk.generateBitmapWord(wordArray)
          : new anchor.BN(0);
        this.bitmapCache.set(currentWordPos, {
          address: bitmapsToFetch[i],
          word,
        });

        if (word && !word.eqn(0)) {
          for (let j = 0; j < 256; j++) {
            if (word.shrn(j).and(new anchor.BN(1)).eqn(1)) {
              const tick = ((currentWordPos << 8) + j) * tickSpacing;
              const tickAddress = this.getTickAddressSync(tick);
              tickAddresses.push(tickAddress);
            }
          }
        }
      }

      const fetchedTicks = await this.program.account.tickState.fetchMultiple(
        tickAddresses
      );

      for (const i in tickAddresses) {
        const fetchedTick = fetchedTicks[i];
        if (!fetchedTick) continue;
        const { tick, liquidityNet } = fetchedTick;
        this.tickCache.set(tick, {
          address: tickAddresses[i],
          liquidityNet: JSBI__default["default"].BigInt(liquidityNet),
        });
      }
    } catch (error) {}
  }
  /**
   * Return accounts to cache and returns early if there is insufficient data
   * @param tickCurrent The current pool tick
   * @param tickSpacing The pool tick spacing
   */

  lazyLoadAccountsToCache(tickCurrent, tickSpacing) {
    // fetch 10 bitmaps on each side in a single fetch. Find active ticks and read them together
    const compressed = JSBI__default["default"].toNumber(
      JSBI__default["default"].divide(
        JSBI__default["default"].BigInt(tickCurrent),
        JSBI__default["default"].BigInt(tickSpacing)
      )
    );
    const { wordPos } = cykuraSdk.tickPosition(compressed);
    const bitmapsToFetch = [];
    const bitmaps = [];
    const { wordPos: WORD_POS_MIN } = cykuraSdk.tickPosition(
      Math.floor(cykuraSdk.TickMath.MIN_TICK / tickSpacing)
    );
    const { wordPos: WORD_POS_MAX } = cykuraSdk.tickPosition(
      Math.floor(cykuraSdk.TickMath.MAX_TICK / tickSpacing)
    );
    const minWord = Math.max(wordPos - 10, WORD_POS_MIN);
    const maxWord = Math.min(wordPos + 10, WORD_POS_MAX);

    for (let i = minWord; i < maxWord; i++) {
      bitmapsToFetch.push(this.getBitmapAddressSync(i));
      const bitmap = this.bitmapCache.get(i);
      bitmaps.push(bitmap);
    }

    const tickAddressesToFetch = [];

    for (let i = 0; i < maxWord - minWord; i++) {
      var _bitmaps$i$word, _bitmaps$i;

      const currentWordPos = i + minWord; // We might not have the bitmap yet in the first iteration

      const word =
        (_bitmaps$i$word =
          (_bitmaps$i = bitmaps[i]) === null || _bitmaps$i === void 0
            ? void 0
            : _bitmaps$i.word) !== null && _bitmaps$i$word !== void 0
          ? _bitmaps$i$word
          : new anchor.BN(0);
      this.bitmapCache.set(currentWordPos, {
        address: bitmapsToFetch[i],
        word,
      });

      if (word && !word.eqn(0)) {
        for (let j = 0; j < 256; j++) {
          if (word.shrn(j).and(new anchor.BN(1)).eqn(1)) {
            const tick = ((currentWordPos << 8) + j) * tickSpacing;
            const tickAddress = this.getTickAddressSync(tick);
            tickAddressesToFetch.push(tickAddress);
          }
        }
      }
    }

    this.accountsToFetch = {
      bitmaps: bitmapsToFetch,
      ticks: tickAddressesToFetch,
    };
    return [...bitmapsToFetch, ...tickAddressesToFetch];
  }

  getTick(tick) {
    let savedTick = this.tickCache.get(tick);

    if (!savedTick) {
      throw new Error("Tick not cached");
    }

    return {
      address: savedTick.address,
      liquidityNet: savedTick.liquidityNet,
    };
  }

  async getTickAddress(tick) {
    return this.getTickAddressSync(tick);
  }

  getTickAddressSync(tick) {
    return web3.PublicKey.findProgramAddressSync(
      [
        cykuraSdk.TICK_SEED,
        this.pool.token0.toBuffer(),
        this.pool.token1.toBuffer(),
        cykuraSdk.u32ToSeed(this.pool.fee),
        cykuraSdk.u32ToSeed(tick),
      ],
      this.program.programId
    )[0];
  }

  async getBitmapAddress(wordPos) {
    return this.getBitmapAddressSync(wordPos);
  }

  getBitmapAddressSync(wordPos) {
    return web3.PublicKey.findProgramAddressSync(
      [
        cykuraSdk.BITMAP_SEED,
        this.pool.token0.toBuffer(),
        this.pool.token1.toBuffer(),
        cykuraSdk.u32ToSeed(this.pool.fee),
        cykuraSdk.u16ToSeed(wordPos),
      ],
      this.program.programId
    )[0];
  }
  /**
   * Fetches the cached bitmap for the word
   * @param wordPos
   */

  getBitmap(wordPos) {
    let savedBitmap = this.bitmapCache.get(wordPos);

    if (!savedBitmap) {
      throw new Error("Bitmap not cached");
    }

    return savedBitmap;
  }
  /**
   * Finds the next initialized tick in the given word. Fetched bitmaps are saved in a
   * cache for quicker lookups in future.
   * @param tick The current tick
   * @param lte Whether to look for a tick less than or equal to the current one, or a tick greater than or equal to
   * @param tickSpacing The tick spacing for the pool
   * @returns
   */

  nextInitializedTickWithinOneWord(tick, lte, tickSpacing) {
    let compressed = JSBI__default["default"].toNumber(
      JSBI__default["default"].divide(
        JSBI__default["default"].BigInt(tick),
        JSBI__default["default"].BigInt(tickSpacing)
      )
    );

    if (tick < 0 && tick % tickSpacing !== 0) {
      compressed -= 1;
    }

    if (!lte) {
      compressed += 1;
    }

    const { wordPos, bitPos } = cykuraSdk.tickPosition(compressed);
    const cachedBitmap = this.getBitmap(wordPos);
    const { next: nextBit, initialized } = cykuraSdk.nextInitializedBit(
      cachedBitmap.word,
      bitPos,
      lte
    );
    const nextTick = cykuraSdk.buildTick(wordPos, nextBit, tickSpacing);
    return [nextTick, initialized, wordPos, bitPos, cachedBitmap.address];
  } // Change this to be a blind decoder rather than decode what we know

  updateCachedAccountInfos(accountInfoMap) {
    for (const bitmapAddress of this.accountsToFetch.bitmaps) {
      const bitmapAccountInfo = accountInfoMap.get(bitmapAddress.toBase58());

      if (bitmapAccountInfo) {
        const tickBitmapState = this.program.coder.accounts.decode(
          "tickBitmapState",
          bitmapAccountInfo.data
        );
        this.bitmapCache.set(tickBitmapState.wordPos, {
          address: bitmapAddress,
          word: cykuraSdk.generateBitmapWord(tickBitmapState.word),
        });
      }
    }

    for (const tickAddress of this.accountsToFetch.ticks) {
      const tickStateAccountInfo = accountInfoMap.get(tickAddress.toBase58());

      if (tickStateAccountInfo) {
        const tickState = this.program.coder.accounts.decode(
          "tickState",
          tickStateAccountInfo.data
        );
        this.tickCache.set(tickState.tick, {
          address: tickAddress,
          liquidityNet: JSBI__default["default"].BigInt(tickState.liquidityNet),
        });
      }
    }
  }
}

function createCykuraSwapInstruction({
  additionalArgs,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userTransferAuthority,
  inAmount,
  minimumOutAmount,
  tokenLedger,
  platformFee,
}) {
  var _platformFee$feeBps15;

  const remainingAccounts = prepareRemainingAccounts(
    inAmount,
    tokenLedger,
    platformFee === null || platformFee === void 0
      ? void 0
      : platformFee.feeAccount
  );
  return JUPITER_PROGRAM.instruction.cykuraSwap(
    inAmount,
    minimumOutAmount,
    (_platformFee$feeBps15 =
      platformFee === null || platformFee === void 0
        ? void 0
        : platformFee.feeBps) !== null && _platformFee$feeBps15 !== void 0
      ? _platformFee$feeBps15
      : 0,
    {
      accounts: {
        swapProgram: CYKURA_PROGRAM_ID,
        signer: userTransferAuthority,
        factoryState: CYKURA_FACTORY_STATE_ADDRESS,
        poolState: additionalArgs.poolAddress,
        inputTokenAccount: userSourceTokenAccount,
        outputTokenAccount: userDestinationTokenAccount,
        inputVault: additionalArgs.inputVault,
        outputVault: additionalArgs.outputVault,
        lastObservationState: additionalArgs.lastObservationState,
        coreProgram: CYKURA_PROGRAM_ID,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
      },
      remainingAccounts: remainingAccounts.concat([
        ...additionalArgs.swapAccountMetas,
        {
          pubkey: additionalArgs.nextObservationState,
          isSigner: false,
          isWritable: true,
        },
      ]),
    }
  );
}
class CykuraAmm {
  constructor(address, accountInfoOrPoolState) {
    this.address = void 0;
    this.label = "Cykura";
    this.id = void 0;
    this.shouldPrefetch = true;
    this.exactOutputSupported = false;
    this.poolState = void 0;
    this.pool = void 0;
    this.tickDataProvider = void 0;
    this.tokens = void 0;
    this.vaults = void 0;
    this.swapAccountMetas = [];
    this.feePct = void 0;
    this.fee = void 0;
    this.address = address;
    this.id = address.toBase58();
    let poolState;

    if ("data" in accountInfoOrPoolState) {
      poolState = CYCLOS_CORE.coder.accounts.decode(
        "poolState",
        accountInfoOrPoolState.data
      );
    } else {
      poolState = accountInfoOrPoolState;
    }

    this.poolState = poolState;
    const { token0, token1, fee, sqrtPriceX32, liquidity, tick } =
      this.poolState;
    this.tickDataProvider = new SolanaTickDataProvider(CYCLOS_CORE, {
      token0,
      token1,
      fee,
    });
    this.tokens = {
      token0: new cykuraSdkCore.Token(101, token0, 0, "", ""),
      token1: new cykuraSdkCore.Token(101, token1, 0, "", ""),
    };
    this.pool = new cykuraSdk.Pool(
      this.tokens.token0,
      this.tokens.token1,
      fee,
      JSBI__default["default"].BigInt(sqrtPriceX32.toString()),
      JSBI__default["default"].BigInt(liquidity.toString()),
      tick,
      this.tickDataProvider
    );
    this.vaults = {
      vault0: web3.PublicKey.findProgramAddressSync(
        [
          this.address.toBuffer(),
          splToken.TOKEN_PROGRAM_ID.toBuffer(),
          token0.toBuffer(),
        ],
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID
      )[0],
      vault1: web3.PublicKey.findProgramAddressSync(
        [
          this.address.toBuffer(),
          splToken.TOKEN_PROGRAM_ID.toBuffer(),
          token1.toBuffer(),
        ],
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID
      )[0],
    };
    this.fee = JSBI__default["default"].BigInt(this.poolState.fee);
    this.feePct =
      this.poolState.fee / JSBI__default["default"].toNumber(FEE_DENOMINATOR);
  }

  getAccountsForUpdate() {
    return [
      this.address,
      ...this.tickDataProvider.lazyLoadAccountsToCache(
        this.pool.tickCurrent,
        this.pool.tickSpacing
      ),
    ];
  }

  update(accountInfoMap) {
    const poolAccountInfo = accountInfoMap.get(this.address.toBase58());

    if (!poolAccountInfo) {
      throw new Error(
        `Could not find poolAccountInfo ${this.address.toBase58()}`
      );
    }

    this.poolState = CYCLOS_CORE.coder.accounts.decode(
      "poolState",
      poolAccountInfo.data
    );
    const { fee, sqrtPriceX32, liquidity, tick } = this.poolState;
    this.pool = new cykuraSdk.Pool(
      this.tokens.token0,
      this.tokens.token1,
      fee,
      JSBI__default["default"].BigInt(sqrtPriceX32.toString()),
      JSBI__default["default"].BigInt(liquidity.toString()),
      tick,
      this.tickDataProvider
    );
    this.tickDataProvider.updateCachedAccountInfos(accountInfoMap);
  }

  getQuote({ sourceMint, amount }) {
    const inputToken = sourceMint.equals(this.poolState.token0)
      ? this.tokens.token0
      : this.tokens.token1;
    const [currentOutAmount, newPool, swapAccountMetas] =
      this.pool.getOutputAmount(
        cykuraSdkCore.CurrencyAmount.fromRawAmount(
          inputToken,
          JSBI__default["default"].BigInt(amount)
        )
      );
    this.swapAccountMetas = swapAccountMetas;
    const priceImpactDecimal = math
      .toDecimal(
        JSBI__default["default"].subtract(
          this.pool.sqrtRatioX32,
          newPool.sqrtRatioX32
        )
      )
      .div(this.pool.sqrtRatioX32.toString());
    return {
      notEnoughLiquidity: false,
      inAmount: amount,
      outAmount: currentOutAmount.quotient,
      // Might not be spot on but avoids many conversions
      feeAmount: JSBI__default["default"].divide(
        JSBI__default["default"].multiply(amount, this.fee),
        FEE_DENOMINATOR
      ),
      feeMint: sourceMint.toBase58(),
      feePct: this.feePct,
      priceImpactPct: priceImpactDecimal.toNumber(),
    };
  }

  createSwapInstructions(swapParams) {
    const [inputVault, outputVault] = swapParams.sourceMint.equals(
      this.poolState.token0
    )
      ? [this.vaults.vault0, this.vaults.vault1]
      : [this.vaults.vault1, this.vaults.vault0];
    const lastObservationState = web3.PublicKey.findProgramAddressSync(
      [
        cykuraSdk.OBSERVATION_SEED,
        this.poolState.token0.toBuffer(),
        this.poolState.token1.toBuffer(),
        cykuraSdk.u32ToSeed(this.poolState.fee),
        cykuraSdk.u16ToSeed(this.poolState.observationIndex),
      ],
      CYKURA_PROGRAM_ID
    )[0];
    const nextObservationState = web3.PublicKey.findProgramAddressSync(
      [
        cykuraSdk.OBSERVATION_SEED,
        this.poolState.token0.toBuffer(),
        this.poolState.token1.toBuffer(),
        cykuraSdk.u32ToSeed(this.poolState.fee),
        cykuraSdk.u16ToSeed(
          (this.poolState.observationIndex + 1) %
            this.poolState.observationCardinalityNext
        ),
      ],
      CYKURA_PROGRAM_ID
    )[0];
    const additionalArgs = {
      poolAddress: this.address,
      inputVault,
      outputVault,
      nextObservationState,
      lastObservationState,
      swapAccountMetas: this.swapAccountMetas,
    };
    return [
      createCykuraSwapInstruction({
        ...swapParams,
        inAmount: swapParams.amount,
        minimumOutAmount: swapParams.otherAmountThreshold,
        additionalArgs,
      }),
    ];
  }

  get reserveTokenMints() {
    return [this.poolState.token0, this.poolState.token1];
  }
}

module.exports = {
  CykuraAmm,
};

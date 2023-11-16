const Token = require("@solana/spl-token").Token;
const TOKEN_PROGRAM_ID = require("@solana/spl-token").TOKEN_PROGRAM_ID;
const TokenInstructions = require("@project-serum/serum").TokenInstructions;
const Market = require("@project-serum/serum").Market;
const DexInstructions = require("@project-serum/serum").DexInstructions;
const web3 = require("@project-serum/anchor").web3;
const BN = require("@project-serum/anchor").BN;
const serumCmn = require("@project-serum/common");
const Transaction = web3.Transaction;
const PublicKey = web3.PublicKey;
const KeyPair = web3.Keypair;
const SystemProgram = web3.SystemProgram;

const DEX_PID = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"); //Serum Dex PID for localnet
// const DEX_PID = new PublicKey("2MMrSASKuSmU7YTdayn9o6eVEbcW6EuCDyj7aXEobddz");
const TOKEN_CACHE = {};

/** Assumptions
 * For each market, we have a different market maker.
 * The market for each swap exists
 * Names of the tokens are case insensitive
 */

async function createMarket(pair, provider, bids, asks) {
  const decimals = 6;
  const amount = 10000 * 10 ** decimals;
  const BN_AMOUNT = 1000000000000;

  //Creating tokens for each element of the pair
  for (let index = 0; index < pair.length; index++) {
    if (TOKEN_CACHE[pair[index]] === undefined) {
      const [MINT, GOD] = await serumCmn.createMintAndVault(
        provider,
        new BN(BN_AMOUNT),
        undefined,
        decimals
      );
      TOKEN_CACHE[pair[index]] = {
        mint: MINT,
        vault: GOD,
      };
    }
  }
  // Creating a funded account to act as market maker and crediting the market maker account with lamports along with
  // transfering the ownership of all tokens to it
  const marketMaker = await fundAccount({
    provider,
    mints: [
      {
        god: TOKEN_CACHE[pair[0]]["vault"],
        mint: TOKEN_CACHE[pair[0]]["mint"],
        amount,
        decimals,
      },
      {
        god: TOKEN_CACHE[pair[1]]["vault"],
        mint: TOKEN_CACHE[pair[1]]["mint"],
        amount,
        decimals,
      },
    ],
  });

  // Creating basevault, quotevault accounts and initializing them
  // Creating market, request queue, event queue, bids and ask accounts and finally initializing market created on the dex.
  // After setting the market up,  adding bids and asks information into the market

  MARKET_A_USDC = await setupMarket({
    baseMint: TOKEN_CACHE[pair[0]]["mint"],
    quoteMint: TOKEN_CACHE[pair[1]]["mint"],
    marketMaker: {
      account: marketMaker.account,
      baseToken: marketMaker.tokens[TOKEN_CACHE[pair[0]]["mint"].toString()],
      quoteToken: marketMaker.tokens[TOKEN_CACHE[pair[1]]["mint"].toString()],
    },
    bids,
    asks,
    provider,
  });

  return {
    market: MARKET_A_USDC,
    marketMaker,
    mintA: TOKEN_CACHE[pair[0]]["mint"],
    mintB: TOKEN_CACHE[pair[1]]["mint"],
    godA: TOKEN_CACHE[pair[0]]["vault"],
    godB: TOKEN_CACHE[pair[1]]["vault"],
  };
}

async function fundAccount({ provider, mints }) {
  const MARKET_MAKER = KeyPair.generate();

  const marketMaker = {
    tokens: {},
    account: MARKET_MAKER,
  };

  // Transfer lamports to market maker.
  await provider.send(
    (() => {
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: MARKET_MAKER.publicKey,
          lamports: 1000000000,
        })
      );
      return tx;
    })()
  );

  // Transfer SPL tokens to the market maker.
  for (let k = 0; k < mints.length; k += 1) {
    const { mint, god, amount, decimals } = mints[k];
    let MINT_A = mint;
    let GOD_A = god;
    // Setup token accounts owned by the market maker.
    const mintAClient = new Token(
      provider.connection,
      MINT_A,
      TOKEN_PROGRAM_ID,
      provider.wallet.payer // node only
    );
    const marketMakerTokenA = await mintAClient.createAccount(
      MARKET_MAKER.publicKey
    );

    await provider.send(
      (() => {
        const tx = new Transaction();
        tx.add(
          Token.createTransferCheckedInstruction(
            TOKEN_PROGRAM_ID,
            GOD_A,
            MINT_A,
            marketMakerTokenA,
            provider.wallet.publicKey,
            [],
            amount,
            decimals
          )
        );
        return tx;
      })()
    );

    marketMaker.tokens[mint.toString()] = marketMakerTokenA;
  }
  return marketMaker;
}

async function setupMarket({
  provider,
  marketMaker,
  baseMint,
  quoteMint,
  bids,
  asks,
}) {
  //creates basevault, quotevault accounts and initializing them
  //creates market, request queue, event queue, bids and ask accounts and finally initializing dex
  const marketAPublicKey = await listMarket({
    connection: provider.connection,
    wallet: provider.wallet,
    baseMint: baseMint,
    quoteMint: quoteMint,
    baseLotSize: 100000,
    quoteLotSize: 100,
    dexProgramId: DEX_PID,
    feeRateBps: 0,
  });
  //Loads the market and its information
  const MARKET_A_USDC = await Market.load(
    provider.connection,
    marketAPublicKey,
    { commitment: "recent" },
    DEX_PID
  );
  // adding ask information in the market
  for (let k = 0; k < asks.length; k += 1) {
    let ask = asks[k];
    const { transaction, signers } =
      await MARKET_A_USDC.makePlaceOrderTransaction(provider.connection, {
        owner: marketMaker.account,
        payer: marketMaker.baseToken,
        side: "sell",
        price: ask[0],
        size: ask[1],
        orderType: "postOnly",
        clientId: undefined,
        openOrdersAddressKey: undefined,
        openOrdersAccount: undefined,
        feeDiscountPubkey: null,
        selfTradeBehavior: "abortTransaction",
      });
    await provider.send(transaction, signers.concat(marketMaker.account));
  }
  // adding bids informating to the market
  for (let k = 0; k < bids.length; k += 1) {
    let bid = bids[k];
    const { transaction, signers } =
      await MARKET_A_USDC.makePlaceOrderTransaction(provider.connection, {
        owner: marketMaker.account,
        payer: marketMaker.quoteToken,
        side: "buy",
        price: bid[0],
        size: bid[1],
        orderType: "postOnly",
        clientId: undefined,
        openOrdersAddressKey: undefined,
        openOrdersAccount: undefined,
        feeDiscountPubkey: null,
        selfTradeBehavior: "abortTransaction",
      });
    await provider.send(transaction, signers.concat(marketMaker.account));
  }

  return MARKET_A_USDC;
}

async function listMarket({
  connection,
  wallet,
  baseMint,
  quoteMint,
  baseLotSize,
  quoteLotSize,
  dexProgramId,
  feeRateBps,
}) {
  const market = web3.Keypair.generate();
  const requestQueue = KeyPair.generate();
  const eventQueue = KeyPair.generate();
  const bids = KeyPair.generate();
  const asks = KeyPair.generate();
  const baseVault = KeyPair.generate();
  const quoteVault = KeyPair.generate();
  const quoteDustThreshold = new BN(100);

  const [vaultOwner, vaultSignerNonce] = await getVaultOwnerAndNonce(
    market.publicKey,

    dexProgramId
  );

  //creating basevault, quotevault accounts and initializing them

  const tx1 = new Transaction();
  tx1.add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: baseVault.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(165),
      space: 165,
      programId: TOKEN_PROGRAM_ID,
    }),
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: quoteVault.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(165),
      space: 165,
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeAccount({
      account: baseVault.publicKey,
      mint: baseMint,
      owner: vaultOwner,
    }),
    TokenInstructions.initializeAccount({
      account: quoteVault.publicKey,
      mint: quoteMint,
      owner: vaultOwner,
    })
  );

  //creating market, request queue, event queue, bids and ask accounts and finally initializing market on the dex
  const tx2 = new Transaction();
  tx2.add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: market.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(
        Market.getLayout(dexProgramId).span
      ),
      space: Market.getLayout(dexProgramId).span,
      programId: dexProgramId,
    }),
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: requestQueue.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(5120 + 12),
      space: 5120 + 12,
      programId: dexProgramId,
    }),
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: eventQueue.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(262144 + 12),
      space: 262144 + 12,
      programId: dexProgramId,
    }),
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: bids.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(65536 + 12),
      space: 65536 + 12,
      programId: dexProgramId,
    }),
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: asks.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(65536 + 12),
      space: 65536 + 12,
      programId: dexProgramId,
    }),
    DexInstructions.initializeMarket({
      market: market.publicKey,
      requestQueue: requestQueue.publicKey,
      eventQueue: eventQueue.publicKey,
      bids: bids.publicKey,
      asks: asks.publicKey,
      baseVault: baseVault.publicKey,
      quoteVault: quoteVault.publicKey,
      baseMint,
      quoteMint,
      baseLotSize: new BN(baseLotSize),
      quoteLotSize: new BN(quoteLotSize),
      feeRateBps,
      vaultSignerNonce,
      quoteDustThreshold,
      programId: dexProgramId,
    })
  );

  const signedTransactions = await signTransactions({
    transactionsAndSigners: [
      { transaction: tx1, signers: [baseVault, quoteVault] },
      {
        transaction: tx2,
        signers: [market, requestQueue, eventQueue, bids, asks],
      },
    ],
    wallet,
    connection,
  });
  for (let signedTransaction of signedTransactions) {
    await sendAndConfirmRawTransaction(
      connection,
      signedTransaction.serialize()
    );
  }

  const acc = await connection.getAccountInfo(market.publicKey);

  return market.publicKey;
}

async function signTransactions({
  transactionsAndSigners,
  wallet,
  connection,
}) {
  const blockhash = (await connection.getRecentBlockhash("max")).blockhash;
  transactionsAndSigners.forEach(({ transaction, signers = [] }) => {
    transaction.recentBlockhash = blockhash;
    transaction.setSigners(
      wallet.publicKey,
      ...signers.map((s) => s.publicKey)
    );
    if (signers?.length > 0) {
      transaction.partialSign(...signers);
    }
  });
  return await wallet.signAllTransactions(
    transactionsAndSigners.map(({ transaction }) => transaction)
  );
}

async function sendAndConfirmRawTransaction(
  connection,
  raw,
  commitment = "recent"
) {
  let tx = await connection.sendRawTransaction(raw, {
    skipPreflight: true,
    maxRetries: 5,
  });
  return await connection.confirmTransaction(tx, commitment);
}

async function getVaultOwnerAndNonce(marketPublicKey, dexProgramId = DEX_PID) {
  const nonce = new BN(0);
  while (nonce.toNumber() < 255) {
    try {
      const vaultOwner = await PublicKey.createProgramAddress(
        [marketPublicKey.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
        dexProgramId
      );
      return [vaultOwner, nonce];
    } catch (e) {
      nonce.iaddn(1);
    }
  }
  throw new Error("Unable to find nonce");
}

module.exports = {
  createMarket,
  DEX_PID,
  TOKEN_CACHE,
  getVaultOwnerAndNonce,
};

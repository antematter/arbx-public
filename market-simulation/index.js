const anchor = require("@project-serum/anchor");
const TOKEN_PROGRAM_ID = require("@solana/spl-token").TOKEN_PROGRAM_ID;
const serumCmn = require("@project-serum/common");
const { Provider } = require("@project-serum/common");
const chalk = require("chalk");
const axios = require("axios");
const web3 = require("@project-serum/anchor").web3;
const KeyPair = web3.Keypair;
const Transaction = web3.Transaction;
const OpenOrders = require("@project-serum/serum").OpenOrders;
const BN = anchor.BN;

const markets = require("./markets");
const utils = require("./utils");
const { IDL } = require("./idl");
const { WALLETS } = require("./wallets");

const PAYER_KEYPAIR = KeyPair.fromSecretKey(WALLETS.LOCAL_WALLET_KEYPAIR);

const TAKER_FEE = 0.0022;

const SWAP_PID = new anchor.web3.PublicKey(
  "22bcx5mVqVgWkey4Y2xVA7NdaYomCDx6TTAgJdRDJmoK" //locatnet swap program id
);

// const SWAP_PID = new anchor.web3.PublicKey("3JAE67V4m8K3xFW6BkinC6nT8opVfNVWjwrhFrUwvkAt");

const Side = {
  Bid: { bid: {} },
  Ask: { ask: {} },
};

const MARKET_CACHE = {};
const log = console.log;

const getAnchorProvider = (connection, wallet) => {
  return new Provider(connection, wallet, {
    preflightCommitment: "confirmed",
    commitment: "confirmed",
    maxRetries: 5,
  });
};

function getContext(network, payer) {
  const networks = {
    localnet: "http://127.0.0.1:8899",
    devnet: "https://api.devnet.solana.com",
  };
  const connection = new anchor.web3.Connection(networks[network], {
    confirmTransactionInitialTimeout: 90000,
    commitment: "recent",
  });
  const wallet = new anchor.Wallet(payer);

  anchor.setProvider(getAnchorProvider(connection, wallet));
  const provider = anchor.getProvider();
  return {
    provider,
    wallet,
    connection,
  };
}

const createMarketNames = (arb, trades) => {
  const pairs = [];
  for (let i = 0; i < arb.length - 1; i++) {
    pairs.push([arb[i], arb[i + 1]]);
  }
  for (let i = 0; i < pairs.length; i++) {
    if (trades[i].toLowerCase() === "ask") {
      //we swap the pairs in case of an ask
      [pairs[i][0], pairs[i][1]] = [pairs[i][1], pairs[i][0]];
    }
  }
  const marketNames = pairs.map((pair) => `${pair[0]}_${pair[1]}`);
  return { marketNames, pairs };
};

const createOrderBookSides = (marketNames, prices, trades) => {
  const sides = {};
  for (let i = 0; i < marketNames.length; i++) {
    sides[marketNames[i]] = {
      // bids: utils.createBidListings(prices[i]),
      // asks: utils.createAskListings(prices[i]),
      bids:
        trades[i].toLowerCase() === "bid"
          ? utils.createBidListings(prices[i])
          : [],
      asks:
        trades[i].toLowerCase() === "ask"
          ? utils.createAskListings(prices[i])
          : [],
    };
  }
  return sides;
};

const createOpenOrderAccounts = async (provider, name) => {
  const openOrders = KeyPair.generate();
  const tx = new Transaction();
  tx.add(
    await OpenOrders.makeCreateAccountTransaction(
      provider.connection,
      MARKET_CACHE[name]["market"]._decoded.ownAddress,
      provider.wallet.publicKey,
      openOrders.publicKey,
      markets.DEX_PID
    )
  );

  const signedTx = await utils.signTransactions({
    transactionsAndSigners: [{ transaction: tx, signers: [openOrders] }],
    wallet: provider.wallet,
    connection: provider.connection,
  });
  const [confirmation, txSig] = await utils.sendAndConfirmRawTransaction(
    provider.connection,
    signedTx[0].serialize()
  );
  return openOrders;
};

const creataSwapAccounts = (marketName, provider) => {
  const market = MARKET_CACHE[marketName]["market"];
  const vaultSigner = MARKET_CACHE[marketName]["vaultSigner"];
  const openOrders = MARKET_CACHE[marketName]["openOrdersPk"];
  const tokenAVault = MARKET_CACHE[marketName]["godA"];
  const tokenBVault = MARKET_CACHE[marketName]["godB"];

  SWAP_A_B_ACCOUNTS = {
    market: {
      market: market._decoded.ownAddress,
      requestQueue: market._decoded.requestQueue,
      eventQueue: market._decoded.eventQueue,
      bids: market._decoded.bids,
      asks: market._decoded.asks,
      coinVault: market._decoded.baseVault,
      pcVault: market._decoded.quoteVault,
      vaultSigner: vaultSigner,
      // User params.
      openOrders: openOrders.publicKey,
      orderPayerTokenAccount: tokenBVault,
      coinWallet: tokenAVault,
    },
    pcWallet: tokenBVault,
    authority: provider.wallet.publicKey,
    dexProgram: markets.DEX_PID,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  };

  SWAP_B_A_ACCOUNTS = {
    ...SWAP_A_B_ACCOUNTS,
    market: {
      ...SWAP_A_B_ACCOUNTS.market,
      orderPayerTokenAccount: tokenAVault,
    },
  };

  return [SWAP_A_B_ACCOUNTS, SWAP_B_A_ACCOUNTS];
};

const initializeMarkets = async (
  provider,
  marketNames,
  orderBookSides,
  pairs
) => {
  log(chalk.blue("> Creating Markets"));
  for (let i = 0; i < marketNames.length; i++) {
    const name = marketNames[i];
    if (MARKET_CACHE[name] == undefined) {
      //creaitng market
      log(chalk.blue(`${name} market does not already exist. Initialzing it`));
      const pair = pairs[i];
      const asks = orderBookSides[name]["asks"];
      const bids = orderBookSides[name]["bids"];
      MARKET_CACHE[name] = await markets.createMarket(
        pair,
        provider,
        bids,
        asks
      );
      log(chalk.blue(`${name} created with asks: ${asks}`));
      log(chalk.blue(`${name} created with bids: ${bids}`));

      log(chalk.yellow(`(✓) Market Created`));
      //creating valultSigner
      const [vaultSigner] = await markets.getVaultOwnerAndNonce(
        MARKET_CACHE[name].market._decoded.ownAddress
      );
      MARKET_CACHE[name]["vaultSigner"] = vaultSigner;
      log(chalk.yellow(`(✓) Vault Signer Added`));
      //creating open orders accoutns
      MARKET_CACHE[name]["openOrdersPk"] = await createOpenOrderAccounts(
        provider,
        name
      );
      log(chalk.yellow(`(✓) Open Orders Account Created`));

      // creating Accounts to perform swap
      const [swap_A_B_Accounts, swap_B_A_Accounts] = creataSwapAccounts(
        name,
        provider
      );
      MARKET_CACHE[name]["Swap_A_B_Accounts"] = swap_A_B_Accounts;
      MARKET_CACHE[name]["Swap_B_A_Accounts"] = swap_B_A_Accounts;
      log(chalk.yellow(`(✓) Swap Acounts Created`));
      log(chalk.green(`(✓) ${name} Market Initialization Completed`));
    }
  }
};

const simulateSwaps = (provider, marketNames, trades, prices) => {
  log(chalk.blue("> Simulating Swaps"));

  const program = new anchor.Program(IDL, SWAP_PID, provider);
  const tx = new Transaction();
  const swapAccounts = [];

  for (let i = 0; i < marketNames.length; i++) {
    const expectedResultantAmount = 1 + i * 0.1; //amount i want to get
    const bestOfferPrice = prices[i];
    log(`Best Price: ${bestOfferPrice}`);
    const amountToSpend = expectedResultantAmount; // amount i am willing to spend
    const swapAmount = new BN(amountToSpend * 10 ** 6);
    console.log(`Swap Amount: ${swapAmount / 10 ** 6}`);

    const name = marketNames[i];
    const incomingSide = trades[i].toLowerCase();
    const side = incomingSide === "bid" ? "ask" : "bid";
    const accounts =
      side === "bid"
        ? MARKET_CACHE[name]["Swap_A_B_Accounts"]
        : MARKET_CACHE[name]["Swap_B_A_Accounts"];
    swapAccounts.push(accounts);
    tx.add(
      program.instruction.swap(
        side === "bid" ? Side.Bid : Side.Ask,
        swapAmount,
        { rate: new BN(1.0), fromDecimals: 6, toDecimals: 6, strict: false },
        {
          accounts,
        }
      )
    );
    log(chalk.yellow(`(✓) Created ${name} Swap Instruction`));
  }
  const addressesList = swapAccounts.map((acc) => utils.extractAddresses(acc));
  let lutAddresses = [].concat.apply([], addressesList);
  lutAddresses = [...new Set(lutAddresses)];
  log(chalk.yellow(`(✓) Address Lookup Table Populated`));

  return [tx, lutAddresses];
};

const executeArb = async (provider, tx, lutAddresses, tokens) => {
  log("Balance before swap");
  await utils.printTokenBalance(provider, markets.TOKEN_CACHE, tokens);
  const serverURL = "http://127.0.0.1:8080/swap";
  payload = {
    instrs: [tx],
    lut_addresses: lutAddresses,
  };
  await axios
    .post(serverURL, payload)
    .then((res) => log(`Server Response: ${res.data}`))
    .catch((error) => log(`Error executing arb: ${error}`));

  console.log(`Balance After Swap`);
  await serumCmn.sleep(20000);

  await utils.printTokenBalance(provider, markets.TOKEN_CACHE, tokens);
};
async function simulateMarket(arb, prices, trades) {
  // build context
  // build markets
  // setup open orders account
  // receive arb from graph thing
  // create necessary markets
  // create swap instructions
  // send those to the for execution

  const { provider, wallet, connection } = getContext(
    "localnet",
    PAYER_KEYPAIR
  );

  const { marketNames, pairs } = createMarketNames(arb, trades);
  const orderBookSides = createOrderBookSides(marketNames, prices, trades);

  await initializeMarkets(provider, marketNames, orderBookSides, pairs);

  const [swapTx, lutAddresses] = simulateSwaps(
    provider,
    marketNames,
    trades,
    prices
  );

  await executeArb(provider, swapTx, lutAddresses, arb);
}
simulateMarket(
  ["SRM", "USDC", "USDT", "SRM"],
  [0.851, 0.9999000099990001, 1.1764705882352942],
  ["BID", "ASK", "ASK"]
).catch((error) => console.log(`Error in execution: ${error}`));

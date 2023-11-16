const splToken = require("@solana/spl-token");
const web3 = require("@solana/web3.js");
const anchor = require("@project-serum/anchor");
const { Provider } = require("@project-serum/common");
const JSBI = require("jsbi");
const Decimal = require("decimal.js");
const fetch = require("cross-fetch");
const executor = require("./SwapExecutor");

const chalk = require("chalk");

const { WALLETS } = require("./wallets");
const utils = require("./utils");
const Constants = require("./constants");
const Backend = require("./backend");

const SwapMode = require("./amms").SwapMode;
const KeyPair = web3.Keypair;
const log = console.log;

const { JUPITER_PROGRAM } = require("./jupiter");

const addressess = {
  inputMint: "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt", //Serum
  outputMint: "So11111111111111111111111111111111111111112", //USDT
};


async function generateArbRoute(
  connection,
  feeCalculator,
  arb,
  startingAmount,
  slippage,
  markets,
  tokenRouteSegments,
  intermediateTokens,
  walletKeyPair,
  serumOpenOrdersPromise,
  token_map
) {
  let amount = startingAmount;
  let finalRoute;
  let startSwapAmount; //same as starting amount but multiplyied by decimals
  let arbRoute = {
    marketInfos: [],
  };

  for (let i = 0; i < arb.length - 1; i++) {
    const first = arb[i];
    const second = arb[i + 1];

    const inputToken = token_map[first];
    const outputToken = token_map[second];

    //create all routes, starting with initial amount and then using what is obtained as a result of second
    const routes = await Backend.getRoutes(
      connection,
      feeCalculator,
      inputToken,
      outputToken,
      amount,
      slippage,
      tokenRouteSegments,
      intermediateTokens,
      markets[i],
      walletKeyPair,
      serumOpenOrdersPromise,
      i % 2 === 0 ? SwapMode.ExactOut: SwapMode.ExactIn
      // i % 2 === 0 ? SwapMode.ExactIn: SwapMode.ExactOut

      // SwapMode.ExactOut
    );
    // console.log(`${first} -> ${second}: ${JSON.stringify(routes[0])}`);

    const route = routes[0];
    arbRoute["marketInfos"].push(route.marketInfos[0]);
    // startSwapAmount = i === 0 ? route["inAmount"] : startSwapAmount;
    
    amount = JSBI.toNumber(route.outAmount)/(10** outputToken.decimals); //order amount to be used as input for next swap leg
    
    console.log(`input amount in next leg: ${route["outAmount"]}`);
    finalRoute = route;
  }
  finalRoute.inAmount;
  delete finalRoute.marketInfos;
  arbRoute = {
    ...arbRoute,
    ...finalRoute,
  };
  arbRoute.inAmount = arbRoute.marketInfos[0].inAmount;
  arbRoute.outAmount =
    arbRoute.marketInfos[arbRoute.marketInfos.length - 1].outAmount;

  console.log(`before ["otherAmountThreshold"]: ${arbRoute["otherAmountThreshold"]}`);
  //lets try substracting amonut 
  // const slippagePenalty = JSBI.BigInt(Math.round(JSBI.toNumber(arbRoute["otherAmountThreshold"]) * 0.03));
  const outAmountThres = JSBI.BigInt(Math.round(JSBI.toNumber(arbRoute["otherAmountThreshold"]) * (1 - slippage / 100)));
  // console.log(`slippage Penalty: ${slippagePenalty}`);
  // arbRoute["otherAmountThreshold"] = JSBI.subtract(arbRoute["otherAmountThreshold"],slippagePenalty);
  arbRoute["otherAmountThreshold"] = [];
  // arbRoute["outAmountWithSlippage"] = outAmountThres;
  console.log(`after ["otherAmountThreshold"]: ${arbRoute["otherAmountThreshold"]}`);

  return arbRoute;
}

// can a route have more than two amms objects in it?
// if no, the current code would suffice
// if yes, how will that effect output mint address?
//if there are intermediary swaps, the output mint of the final marketinfo object is our output mint
async function main() {
  const walletKeyPair = KeyPair.fromSecretKey(WALLETS.WARREN_WALLET_KEYPAIR);
  const connection = utils.getContext("mainnet");
  console.log(`loading market info`);

  const [tokenRouteSegments, intermediateTokens] = await Backend.loadMarketInfo(
    connection,
    "mainnet-beta",
    null
  );
  console.log(`loaded market info`);

  const { value } = await connection.getRecentBlockhashAndContext("processed");
  const feeCalculator = value.feeCalculator;
  console.log(`loaded fee calculator`);

  const cluster = "mainnet-beta";


  const wrapUnwrapSOL = true;
  const serumOpenOrdersPromise = await utils.findSerumOpenOrdersForOwner(
    connection,
    cluster,
    walletKeyPair
  );
  const token_map = await utils.getTokensInfo();
  console.log(`Obtained token map`);

  const arbRoute = await generateArbRoute(
    connection,
    feeCalculator,
    ["SRM", "SOL", "USDT", "SRM"],
    0.1,
    10.0,
    ["Raydium", "Raydium","Raydium"],
    tokenRouteSegments,
    intermediateTokens,
    walletKeyPair,
    serumOpenOrdersPromise,
    token_map
  );

  console.log(`Arb Route: ${JSON.stringify(arbRoute)}`);

  const quoteMintToReferrer = await utils.getPlatformFeeAccounts(connection, new web3.PublicKey(Constants.JUPITER_WALLET));
  console.log(`Executing Swap`);
  const {execute} = await executor.performSwap(connection,serumOpenOrdersPromise,arbRoute,walletKeyPair,undefined,wrapUnwrapSOL,quoteMintToReferrer);
  const swapResult = await execute();
  console.log(`https://explorer.solana.com/tx/${swapResult.txid}`);



  // const wallet = new anchor.Wallet(walletKeyPair);

  // anchor.setProvider(getAnchorProvider(connection, wallet));
  // const provider = anchor.getProvider();

  // const JUPITER_PROGRAM = new anchor.Program(IDL, JUPITER_PROGRAM_ID,{});

  // const owner = new utils.Owner(walletKeyPair);

  // const sourceInstr = await Backend.makeSourceInstruction(true,connection,owner,route,addressess.inputMint);

  // console.log(await Backend.fetchMarketCache(constants.MARKETS_URL['mainnet-beta']));

  // console.log(`Token Route Segments: ${JSON.stringify(tokenRouteSegments)}`);
  // const inputSegment = tokenRouteSegments.get(addressess.inputMint);
  // const outputSegment = tokenRouteSegments.get(addressess.outputMint);

  //the segments contains a token address and all its markets and amms on which the source token can be traded
  // console.log(`input segment: ${JSON.stringify([...inputSegment.entries()])}`);
  // console.log(`Intermediate Tokens: ${intermediateTokens}`);

  // const tokens = await(await fetch('https://cache.jup.ag/tokens')).json();
  // const inputToken = tokens.find((t) => t.address == addressess.inputMint); // USDC Mint Info
  // const outputToken = tokens.find((t) => t.address == addressess.outputMint); // USDT Mint Info

  // process.exit(-1);
  // console.log(`Routes: ${JSON.stringify(routes)}`);


  // console.log(`https://explorer.solana.com/tx/${swapResult.txid}`);

  // console.log(`Best Trade routeRoute: ${JSON.stringify(routes)}`);
}

main()
  .then(() => log(chalk.green(`( ✔ ) Funciton Executed Successfully`)))
  .catch((error) => log(chalk.red(`( ❌ ) ${error}`)));

// await main();

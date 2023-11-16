// import {
//   AccountInfo,
//   Connection,
//   PublicKey,
//   Keypair,
//   Transaction,
//   Signer,
//   TransactionInstruction,
//   AccountMeta,
// } from "@solana/web3.js";
// import {
//   TokenAccount,
//   Liquidity,
//   LiquidityPoolKeys,
//   TokenAmount,
//   Token,
//   Percent,
//   LiquidityFetchInfoParams,
//   Trade,
//   LiquidityPoolInfo,
//   CurrencyAmount,
//   Price,
// } from "@raydium-io/raydium-sdk";
// import {createSerumSwapInstruction} from "./serum-backend"
// import { computeAmountOut, computeAmountIn, sendTx } from "./raydium-backend/utils";
// import {tokenMints} from "./tokensInfo";
// import { assert } from "console";
// import { Leg, Side } from "./types";

// export async function swap(
//   connection: Connection,
//   poolKeys: LiquidityPoolKeys,
//   ownerKeypair: Keypair,
//   tokenAccounts: TokenAccount[],
//   amount: number,
//   slippageAmount: number,
// ) {
//   console.log("swap start");

//   const owner = ownerKeypair.publicKey;
//   try {
//     console.log(`fetching pool info`);
//     const params: LiquidityFetchInfoParams = { connection, poolKeys };
//     console.log(`params: ${params}`);

//     const poolInfo = await Liquidity.fetchInfo(params);

//     console.log(`fetched pool info`);

//     // real amount = 1000000 / 10**poolInfo.baseDecimals
//     const amountIn = new TokenAmount(new Token(poolKeys.baseMint, poolInfo.baseDecimals), amount, false);
//     console.log(`In amount key: ${poolKeys.baseMint}`);

//     const currencyOut = new Token(poolKeys.quoteMint, poolInfo.quoteDecimals);
//     console.log(`Out amount key: ${poolKeys.quoteMint}`);
//     console.log(`currency out: ${JSON.stringify(currencyOut)}`);

//     // slippageAmount% slippage
//     const slippage = new Percent(slippageAmount, 100);

//     const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } = computeAmountOut({
//       poolKeys,
//       poolInfo,
//       amountIn,
//       currencyOut,
//       slippage,
//     });

//     // @ts-ignore
//     console.log(
//       `amountOut: ${amountOut.toFixed()}, minAmountOut: ${minAmountOut.toFixed()}, currentPrice: ${currentPrice.toFixed()}, executionPrice${executionPrice?.toFixed()}, priceImpact: ${priceImpact.toFixed()}, fee ${fee.toFixed()}`,
//     );

//     console.log(
//       `swap: ${poolKeys.id.toBase58()}, amountIn: ${amountIn.toFixed()}, amountOut: ${amountOut.toFixed()}, executionPrice: ${executionPrice?.toFixed()}`,
//     );
//     // const minAmountOut = new TokenAmount(new Token(poolKeys.quoteMint, poolInfo.quoteDecimals), 1000000)

//     const { transaction, signers } = await Liquidity.makeSwapTransaction({
//       connection,
//       poolKeys,
//       userKeys: {
//         tokenAccounts,
//         owner,
//       },
//       amountIn,
//       amountOut: minAmountOut,
//       fixedSide: "in",
//     });

//     await sendTx(connection, transaction, [ownerKeypair, ...signers]);
//     console.log("swap end");
//   } catch (error: any) {
//     console.log(`error fetching pool info: ${error}`);
//     console.log(`Stack Trace: ${error.stack}`);
//   }
// }

// function createArbLegs(arb: Array<string>, sides: Array<Side>, mints: tokenMints, markets: Set<string>, poolParams:LiquidityPoolInfo) {
//   const arbLegs: Array<Leg> = [];
//   let baseMint: PublicKey;
//   let quoteMint: PublicKey;
//   const baseMintDecimals:number = poolParams.baseDecimals;
//   const quoteMintDecimals:number = poolParams.quoteDecimals;

//   for (let index = 0; index < arb.length - 1; index++) {
//     const possibleMarketA = `${arb[index]}-${arb[index + 1]}`;
//     const possibleMarketB = `${arb[index + 1]}-${arb[index]}`;

//     if(markets.has(possibleMarketA)){
//       baseMint = mints[(arb[index])];
//       quoteMint = mints[(arb[index + 1])];
//     }
//     else{
//       assert(markets.has(possibleMarketB),"Specifed market does not exist");
//       baseMint = mints[(arb[index + 1])];
//       quoteMint = mints[(arb[index])];
//     }
//     const leg: Leg = { baseMint, quoteMint, baseMintDecimals,quoteMintDecimals, side: sides[index]};
//     arbLegs.push(leg);
//   }
//   return arbLegs;
// }

// async function createSwapInstruction(
//   connection: Connection,
//   poolKeys: LiquidityPoolKeys,
//   poolInfo: LiquidityPoolInfo,
//   ownerKeypair: Keypair,
//   tokenAccounts: TokenAccount[],
//   amount: number,
//   slippageAmount: number,
//   arbLeg:Leg
// ) {

//   const owner = ownerKeypair.publicKey;
//   // try {

//     // real amount = 1000000 / 10**poolInfo.baseDecimals
//     // if(side === Side.Ask){
//     //   [baseMint,quoteMint] = [quoteMint,baseMint];
//     //   [baseMintDecimals, quoteMintDecimals] = [quoteMintDecimals,baseMintDecimals];
//     // }

//     // console.log(`Base token decimals: ${baseMintDecimals}`);
//     // const amountIn = new TokenAmount(new Token(baseMint, baseMintDecimals), amount, false);
//     // console.log(`In amount key: ${baseMint}`);

//     // const currencyOut = new Token(quoteMint,quoteMintDecimals);
//     // console.log(`Out amount key: ${quoteMint}`);

//     // slippageAmount% slippage
//     const slippage = new Percent(slippageAmount, 100);

//     let amountIn:TokenAmount | CurrencyAmount;
//     let currencyOut: Token;

//     let amount_out: TokenAmount | CurrencyAmount,
//       min_amount_out: TokenAmount | CurrencyAmount,
//       current_price: Price,
//       execution_price: Price | null,
//       price_impact: Percent,
//       fee_charged: CurrencyAmount;

//     if (arbLeg.side === Side.Bid) {
//       console.log(`placing bid`);
//       amountIn = new TokenAmount(new Token(arbLeg.quoteMint!, arbLeg.quoteMintDecimals), amount, false);
//       currencyOut = new Token(arbLeg.baseMint!, arbLeg.baseMintDecimals);
//       console.time("computeAmountOut");
//       const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } = computeAmountOut({
//         poolKeys,
//         poolInfo,
//         amountIn,
//         currencyOut,
//         slippage,
//       });
//       console.timeEnd("computeAmountOut");
//       amount_out = amountOut;
//       min_amount_out = minAmountOut;
//       current_price = currentPrice;
//       execution_price = executionPrice;
//       price_impact = priceImpact;
//       fee_charged = fee;

//     } else {
//       console.log(`placing ask`);
//       amountIn = new TokenAmount(new Token(arbLeg.baseMint!, arbLeg.baseMintDecimals), amount, false);
//       currencyOut = new Token(arbLeg.quoteMint!, arbLeg.quoteMintDecimals);
//       console.time("computeAmountOut");
//       const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } = computeAmountOut({
//         poolKeys,
//         poolInfo,
//         amountIn,
//         currencyOut,
//         slippage,
//       });
//       console.timeEnd("computeAmountOut");
//       amount_out = amountOut;
//       min_amount_out = minAmountOut;
//       current_price = currentPrice;
//       execution_price = executionPrice;
//       price_impact = priceImpact;
//       fee_charged = fee;
//     }

//     const prices = {
//       amount_out : amount_out.toFixed(),
//       min_amount_out : min_amount_out.toFixed(),
//       current_price : current_price.toFixed(),
//       execution_price : execution_price?.toFixed(),
//       price_impact : price_impact.toFixed(),
//       fee_charged : fee_charged.toFixed(),
//     }

//     console.log(`trade prices details: ${JSON.stringify(prices,null,4)}`);
//     // console.log(
// //       `amountOut: ${amount_out.toFixed()}, minAmountOut: ${min_amount_out.toFixed()}, currentPrice: ${current_price.toFixed()}, executionPrice${execution_price?.toFixed()}, priceImpact: ${price_impact.toFixed()}, fee ${fee_charged.toFixed()}`,
//     // );

//     // const minAmountOut = new TokenAmount(new Token(poolKeys.quoteMint, poolInfo.quoteDecimals), 1000000)

//     // const { transaction, signers } = await Liquidity.makeSwapTransaction({

//       return {...await Liquidity.makeSwapTransaction({
//       connection,
//       poolKeys,
//       userKeys: {
//         tokenAccounts,
//         owner,
//       },
//       amountIn,
//       amountOut: min_amount_out,
//       fixedSide: "in",
//     }), amountOut: Number(amount_out.toFixed())};
// }
// export async function createArb(
//   connection: Connection,
//   poolKeys: LiquidityPoolKeys,
//   arb: Array<string>,
//   markets: Set<string>,
//   volumes: Array<number>,
//   sides: Array<Side>,
//   ownerKeypair: Keypair,
//   tokenAccounts: TokenAccount[],
//   inAmount: number,
//   slippageAmount: number,
//   mints: tokenMints,
// ) {
//   //if ask swap "swap pair places"
//   console.log(`inside pool`);
//   const params: LiquidityFetchInfoParams = { connection, poolKeys };
//   const poolInfo = await Liquidity.fetchInfo(params); //this call can be skipped if we can have pool's liquidy information i.e base and quote reserve
//   console.log(`creating arb legs`);
//   const arbLegs: Array<Leg> = createArbLegs(arb, sides, mints,markets,poolInfo);
//   console.log(`Arb Legs: ${JSON.stringify(arbLegs,null,4)}`);

//   const tx: Transaction = new Transaction();
//   const signersList: Signer[] = [];
//   let legInAmount = inAmount;
//   const routeFares = [0.9998, 1352.01,1352.47];
//   let index = 0;
//   for(let leg of arbLegs) {
//     console.log(`in Amount : ${legInAmount}`);
//     const swapInstr = await  createSerumSwapInstruction(connection,ownerKeypair.publicKey,ownerKeypair,leg,1,routeFares[index],legInAmount);
//     index+=1;
//     legInAmount = swapInstr!.outAmount;
//     // const {transaction, signers, amountOut} = await createSwapInstruction(connection,poolKeys,poolInfo,ownerKeypair,tokenAccounts,legInAmount,slippageAmount,leg)
//     // console.log(`Added signers: ${signers.length}`);
//     // legInAmount = amountOut;
//     tx.add(swapInstr!.instructions);
//     for(let signer of swapInstr!.signers){
//       signersList.push(signer!);
//     }

//   }
//   console.log(`number of instructions: ${tx.instructions.length}`);
//   console.log(`Number of signers: ${signersList.length}`);
//   // console.log(`Sending transaction...`);

//   await sendTx(connection,tx,[...new Set([ownerKeypair, ...signersList])]);

//   //create swaps for the arbs such that the output amount obtained after x - 1 leg becomes the input amount of x leg
// }

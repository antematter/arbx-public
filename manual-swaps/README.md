## Dexes currently supported:
1. Orca
2. Ray

## How to perform manual swaps:

### 1. Manually constructing arbitrage legs

```ts
import { BuySide, Dex } from "./utils/types";
import { ArbitrageExecutor } from "./src/arb-executor";

(async () => {
  /* --------------------------------
       [SOL-USDC] <==> [Base-Quote] 
     -------------------------------- */
  
  /* 
    1. Single arb leg
  */
  await new ArbitrageExecutor()
    .queueArbitrageLeg({
      firstToken: "SOL",
      secondToken: "USDC",
      buySide: BuySide.Base, // Swap From SOL to USDC
      dex: Dex.Orca,
    })
    .execute(1); // 1 is the starting swap amount
    
  /* 
    2. Multiple arbitrage legs
  */
  await new ArbitrageExecutor()
    .queueArbitrageLeg({
      firstToken: "SOL",
      secondToken: "USDC",
      buySide: BuySide.Base, // Swap From SOL to USDC
      dex: Dex.Orca,
    })
    .queueArbitrageLeg({
      firstToken: "SOL",
      secondToken: "USDC",    
      buySide: BuySide.Quote, // Swap From USDC to SOL
      dex: Dex.Raydium,
    })
    .execute(1); // 1 is the swap amount for the first arbitrage leg
  
})();

```

## Points to note:
1. In the `queueArbitrageLeg` method, the `firstToken` and `secondToken` parameters can be interchanged and don't necessarily have to be in the correct order. The code will check for both possible pairs i.e. `firstToken-secondToken` and `secondToken-firstToken` and use the one which actually exists.
2. The `buySide` parameter will apply to the correct orientation of the `firstToken` and `secondToken` parameters so even if you specify the `firstToken` as USDC and the `secondToken` as SOL, this does not mean that the base token will be USDC and the quote token will be SOL. The code will rearrange the `firstToken` and `secondToken` interally to `SOL-USDC` which is the correct orientation and the `buySide` will apply to that orientation.

---
### 2. Directly executing a JSON arbitrage from the feed 

```ts
import { executeRawArbitrage } from "./src/raw-arbs";

(async () => {
  await executeRawArbitrage(
    {
      prices: [0.004142513534378794, 1251.749500117581],
      volumes: [5627.739012, 517631.15258699993],
      tokens: ["USDC", "ETH"],
      markets: ["ORCA"],
      profit_potential: 5.185389245888969,
      timestamp: "2022-11-15T07:00:27.233",
      trades: ["BID"],
    },
    100 // Optional starting amount
  );
})();

```
## Points to note:
`executeRawArbitrage` accepts an optional `startingAmount` parameter which will be used as the starting amount for the first arbitrage leg. However, if this is not specified, the arbitrage will be executed by using `INITIAL_SWAP_DOLLAR_AMOUNT` specified in `utils/constants.ts` as the starting dollar amount. There is an important distinction between starting dollar amount and starting amount that one must be mindful of.

When a starting dollar amount is used, it will cause an extra arbitrage leg to be created at the beginning where the specified amount of tokens of the current first arb leg are converted to from USDC e.g. assuming `INITIAL_SWAP_DOLLAR_AMOUNT` is set to 5 and there is an arb that goes from `SOL-USDC-SOL`, using a starting dollar amount will create an extra arb leg like so: `(USDC)-SOL-USDC-SOL` in which we will convert $5 worth of USDC to SOL and use that SOL as the input to the next arb leg. 

There are two reasons for doing this: 
1. an arb might contain a token for which we don't have any balance in our wallet so converting into that token from USDC allows us to execute the arb 
1. using a preset input amount will prevent execution of arbs for expensive tokens like ETH or BTC e.g. if the starting amount is always 1 and we process an arb that goes from BTC-USDC, then it is unlikely to be executed as we probably won't have 1 BTC in our wallet.

---
### 3. Executing arbs from the feed server

```ts
import { executeArbsFromFeed } from "./src/feed"

(async () => {
  await executeArbsFromFeed();
})();
```

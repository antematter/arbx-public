import { Market, OpenOrders } from "@project-serum/serum";
import { LiquidityPoolKeys, TokenAccount } from "@raydium-io/raydium-sdk";
import { AddressLookupTableAccount, Connection, Keypair, PublicKey } from "@solana/web3.js";
import fetch from "cross-fetch";
import { getTokenAccountsByOwner } from "./utils";
import fs from "fs";
import { MARKETS_KEYS_INFO } from "./raydiumMarketKeysInfo";
import { ENABLE_TRADING, MAINNET_SERUM_DEX_PROGRAM, TRANSACTION_LOGS_DIR } from "./constants";
import logger from "./logger";

/**
 * Populates caches in the start of the program with
 *  - Token Mints
 *  - Serum Market address
 *  - Raydium Market addresses
 *  - Other stuff if needed
 */
const OPEN_ORDERS_DIR_PATH = `${TRANSACTION_LOGS_DIR}/open-orders`;
const OPEN_ORDER_FILE_PATH = `${OPEN_ORDERS_DIR_PATH}/open-orders.json`;

export class DataStore {
  //common
  public tokenMints: Map<string, PublicKey>; //token symbol to token mint
  public tokenDecimals: Map<string, number>; //token symbol to its decimals
  public mintTokens: Map<string, string>; //token mint to token symbol
  public tokenAccounts: Map<string, PublicKey>; //associated token accounts for the user. Token mint against ATA's pubkey
  public serumMarketsLookupTableAccounts?: Map<string, AddressLookupTableAccount>; // market symbol against the lut address it's in
  public raydiumMarketsLookupTableAccounts?: Map<string, AddressLookupTableAccount>; // market symbol agains the lut address it's in
  public serumDecodedMarkets: Map<string, any>;
  public tokenAccountsArray: TokenAccount[];
  public owner: Keypair;

  //Raydium Specific
  public raydiumMarketKeys: Map<string, LiquidityPoolKeys>;

  //Serum Specific
  public serumMarketKeys: Map<string, Market>;
  public serumOpenOrdersAccounts: Map<string, PublicKey>;

  private constructor(owner: Keypair) {
    this.owner = owner;

    this.tokenMints = new Map();
    this.mintTokens = new Map();
    this.tokenDecimals = new Map();
    this.tokenAccounts = new Map();
    this.raydiumMarketKeys = new Map();
    this.serumOpenOrdersAccounts = new Map();
    this.serumMarketKeys = new Map();
    this.serumDecodedMarkets = new Map();
    this.tokenAccountsArray = [];
  }

  public static async populate(connection: Connection, owner: Keypair) {
    const instance = new DataStore(owner);

    //populating token mints and mint tokens
    const raw_tokens = await (await fetch("https://cache.jup.ag/tokens")).json();
    for (let token of raw_tokens) {
      if (token["chainId"] === 101) {
        instance.tokenMints.set(token["symbol"], new PublicKey(token["address"]));
        instance.tokenDecimals.set(token["symbol"], token["decimals"]);
        instance.mintTokens.set(token["address"], token["symbol"]);
      }
    }

    //populating token accounts for the user
    const tokenAccounts = await getTokenAccountsByOwner(connection, owner.publicKey);
    instance.tokenAccountsArray = tokenAccounts;
    for (let tokenAcc of tokenAccounts) {
      instance.tokenAccounts.set(tokenAcc.accountInfo.mint.toString(), tokenAcc.pubkey);
    }
    // instance.tokenAccounts.set("So11111111111111111111111111111111111111112", owner.publicKey);

    //populating raydium market is very slow so we obtain them from cache
    Object.keys(MARKETS_KEYS_INFO).forEach((key) => {
      instance.raydiumMarketKeys.set(key, MARKETS_KEYS_INFO[key]);
    });

    //populating Serum open order accounts
    instance.serumOpenOrdersAccounts = await findSerumOpenOrdersForOwner(connection, owner.publicKey);

    //populating serum market
    const markets = ((await (await fetch("https://cache.jup.ag/markets?v=3")).json()) as Array<any>).filter(
      (market) => {
        return market.owner === MAINNET_SERUM_DEX_PROGRAM.toString();
      },
    );
    const marketKeyedAccountInfos = marketCacheToAccountInfo(markets);

    marketKeyedAccountInfos.forEach((market: any) => {
      const decoded = Market.getLayout(MAINNET_SERUM_DEX_PROGRAM).decode(market.data);
      const baseMint = decoded["baseMint"];
      const quoteMint = decoded["quoteMint"];
      const marketSymbol = `${instance.mintTokens.get(baseMint.toString())}-${instance.mintTokens.get(
        quoteMint.toString(),
      )}`;

      instance.serumDecodedMarkets.set(marketSymbol, decoded);

      const marketObj = new Market(
        decoded,
        instance.tokenDecimals.get(instance.mintTokens.get(baseMint.toString())!)!,
        instance.tokenDecimals.get(instance.mintTokens.get(quoteMint.toString())!)!,
        undefined,
        MAINNET_SERUM_DEX_PROGRAM,
      );
      instance.serumMarketKeys.set(marketSymbol, marketObj);
    });
    return instance;
  }

  async populateSerumMarketsLookupTableAccounts(connection: Connection, lutAddresses: Map<string, PublicKey>) {
    if (!this.serumMarketsLookupTableAccounts) {
      this.serumMarketsLookupTableAccounts = new Map();
    }
    for (let [symbol, address] of lutAddresses) {
      const lookupTableAccount = (await connection.getAddressLookupTable(address)).value!;
      this.serumMarketsLookupTableAccounts!.set(symbol, lookupTableAccount);
    }
  }
  async populateRaydiumMarketLookupTableAccounts(connection: Connection, lutAddress: Map<string, PublicKey>) {
    if (!this.raydiumMarketsLookupTableAccounts) {
      this.raydiumMarketsLookupTableAccounts = new Map();
    }
    for (let [symbol, address] of lutAddress) {
      const lookupTableAccount = (await connection.getAddressLookupTable(address)).value!;
      this.raydiumMarketsLookupTableAccounts!.set(symbol, lookupTableAccount);
    }
  }

  updateOpenOrderCache(marketAddress: PublicKey, ooAccountAddress: PublicKey) {
    this.serumOpenOrdersAccounts.set(marketAddress.toString(), ooAccountAddress);
    const ooCache: any = {};
    for (let [key, value] of this.serumOpenOrdersAccounts) {
      ooCache[key] = value.toString();
    }
    fs.writeFileSync(OPEN_ORDER_FILE_PATH, JSON.stringify(ooCache), { encoding: "utf8" });
  }
}

function marketCacheToAccountInfo(marketsCache: Array<any>) {
  return marketsCache.map((market) => {
    const {
      data: [accountInfo, format],
      pubkey,
      ...rest
    } = market;
    return {
      ...rest,
      pubkey: new PublicKey(pubkey),
      data: Buffer.from(accountInfo, format),
      owner: new PublicKey(rest.owner),
    };
  });
}

async function findSerumOpenOrdersForOwner(connection: Connection, userPublicKey: PublicKey) {
  const newMarketToOpenOrdersAddress = new Map<string, PublicKey>();
  let needsFetching = false;
  logger.info("Populating open orders");

  if (!fs.existsSync(OPEN_ORDERS_DIR_PATH)) {
    fs.mkdirSync(OPEN_ORDERS_DIR_PATH);
  }

  if (!fs.existsSync(OPEN_ORDER_FILE_PATH)) {
    needsFetching = true;
  } else {
    const rawData = fs.readFileSync(OPEN_ORDER_FILE_PATH, "utf-8");
    if (rawData) {
      const ooCache = JSON.parse(rawData);
      if (Object.keys(ooCache).length === 0) {
        needsFetching = true;
      } else {
        for (let key of Object.keys(ooCache)) {
          newMarketToOpenOrdersAddress.set(key, new PublicKey(ooCache[key]));
        }
      }
    } else {
      needsFetching = true;
    }
  }
  if (needsFetching && ENABLE_TRADING) {
    const allOpenOrders = await OpenOrders.findForOwner(connection, userPublicKey, MAINNET_SERUM_DEX_PROGRAM);
    allOpenOrders.forEach((openOrders) => {
      newMarketToOpenOrdersAddress.set(openOrders.market.toString(), openOrders.address);
    });
    const ooCache: any = {};
    for (let [key, value] of newMarketToOpenOrdersAddress) {
      ooCache[key] = value.toString();
    }
    fs.writeFileSync(OPEN_ORDER_FILE_PATH, JSON.stringify(ooCache), { encoding: "utf8" });
  }
  logger.info("Open orders have been populated");
  return newMarketToOpenOrdersAddress;
}

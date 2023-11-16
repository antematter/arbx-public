import fetch from "cross-fetch";

import {
  LIQUIDITY_STATE_LAYOUT_V4,
  TOKEN_PROGRAM_ID,
  TokenAccount,
  SPL_ACCOUNT_LAYOUT,
  Liquidity,
  Market,
  SERUM_PROGRAM_ID_V3,
  LIQUIDITY_PROGRAM_ID_V4,
  LiquidityPoolKeys,
  jsonInfo2PoolKeys,
} from "@raydium-io/raydium-sdk";

import { OpenOrders } from "@project-serum/serum";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";

import { MARKETS_URL, RAYDIUM_AMM_V4_PROGRAM_ID } from "./constants";
import { BN } from "bn.js";

export type MarketCache = Omit<AccountInfo<Buffer>, "data" | "owner"> & {
  data: [string, "base64"];
  owner: PublicKey;
  pubkey: PublicKey;
  executable?: boolean;
  lamports?: number;
  rentEpoch?: number;
};

export type MarketsCache = Array<MarketCache>;

export async function fetchRaydiumMarketsKeys(): Promise<MarketsCache> {
  const marketsCache = (await (await fetch(MARKETS_URL)).json()) as Array<any>;
  return marketsCache
    .map((market) => {
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
    })
    .filter((market: MarketCache) => {
      return market.owner.toString() === RAYDIUM_AMM_V4_PROGRAM_ID;
    }) as MarketsCache;
}

export async function getMarketLiquidityInformation(
  connection: Connection,
  poolId: PublicKey,
  dexProgramId: PublicKey,
) {
  const info = await connection.getAccountInfo(poolId);
  if (info === null) throw Error(`Failed to fetch market information: ${poolId}`);

  const state = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);
  const baseTokenAmount = await connection.getTokenAccountBalance(state.baseVault);
  const quoteTokenAmount = await connection.getTokenAccountBalance(state.quoteVault);
  const openOrders = await OpenOrders.load(connection, state.openOrders, dexProgramId);

  const baseDecimal = 10 ** state.baseDecimal.toNumber();
  const quoteDecimal = 10 ** state.quoteDecimal.toNumber();

  const openOrdersTotalBase = openOrders.baseTokenTotal.toNumber() / baseDecimal;
  const openOrdersTotalQuote = openOrders.quoteTokenTotal.toNumber() / quoteDecimal;

  const basePnl = state.baseNeedTakePnl.toNumber() / baseDecimal;
  const quotePnl = state.quoteNeedTakePnl.toNumber() / quoteDecimal;

  // @ts-ignore
  const base = baseTokenAmount.value?.uiAmount + openOrdersTotalBase - basePnl;

  // @ts-ignore
  const quote = quoteTokenAmount.value?.uiAmount! + openOrdersTotalQuote - quotePnl;

  const lpSupply = parseFloat(state.lpReserve.toString());
  const priceInQuote = quote / base;
  return {
    market: poolId,
    baseMint: state.baseMint,
    quoteMint: state.quoteMint,
    base,
    quote,
    lpSupply,
    baseVaultKey: state.baseVault,
    quoteVaultKey: state.quoteVault,
    baseVaultBalance: baseTokenAmount.value.uiAmount,
    quoteVaultBalance: quoteTokenAmount.value.uiAmount,
    openOrdersKey: state.openOrders,
    openOrdersTotalBase,
    openOrdersTotalQuote,
    basePnl,
    quotePnl,
    priceInQuote,
  };
}

export async function getTokenAccountsByOwner(connection: Connection, owner: PublicKey) {
  const tokenResp = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const accounts: TokenAccount[] = [];

  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
    });
  }

  return accounts;
}

//fetches amm pool keys that are needed while constructing swap transactions
export async function fetchPoolKeys(connection: Connection, poolId: PublicKey, version: number = 4) {
  // const version = 4
  const serumVersion = 3;
  const marketVersion = 3;

  const programId = LIQUIDITY_PROGRAM_ID_V4;
  const serumProgramId = SERUM_PROGRAM_ID_V3;

  const account = await connection.getAccountInfo(poolId);
  const { state: LiquidityStateLayout } = Liquidity.getLayouts(version);

  //@ts-ignore
  const fields = LiquidityStateLayout.decode(account.data);
  const { status, baseMint, quoteMint, lpMint, openOrders, targetOrders, baseVault, quoteVault, marketId } = fields;

  let withdrawQueue, lpVault;
  if (Liquidity.isV4(fields)) {
    withdrawQueue = fields.withdrawQueue;
    lpVault = fields.lpVault;
  } else {
    withdrawQueue = PublicKey.default;
    lpVault = PublicKey.default;
  }

  // uninitialized
  // if (status.isZero()) {
  //   return ;
  // }

  const associatedPoolKeys = await Liquidity.getAssociatedPoolKeys({
    version,
    baseMint,
    quoteMint,
    marketId,
    baseDecimals: 0,
    quoteDecimals: 0,
  });

  const poolKeys = {
    id: poolId,
    baseMint,
    quoteMint,
    lpMint,
    version,
    programId,

    authority: associatedPoolKeys.authority,
    openOrders,
    targetOrders,
    baseVault,
    quoteVault,
    withdrawQueue,
    lpVault,
    marketVersion: serumVersion,
    marketProgramId: serumProgramId,
    marketId,
    marketAuthority: associatedPoolKeys.marketAuthority,
  };

  const marketInfo = await connection.getAccountInfo(marketId);
  const { state: MARKET_STATE_LAYOUT } = Market.getLayouts(marketVersion);
  //@ts-ignore
  const market = MARKET_STATE_LAYOUT.decode(marketInfo.data);

  const {
    baseVault: marketBaseVault,
    quoteVault: marketQuoteVault,
    bids: marketBids,
    asks: marketAsks,
    eventQueue: marketEventQueue,
  } = market;

  // const poolKeys: LiquidityPoolKeys;
  return {
    ...poolKeys,
    ...{
      marketBaseVault,
      marketQuoteVault,
      marketBids,
      marketAsks,
      marketEventQueue,
    },
  };
}

export async function fetchAllPoolKeys(): Promise<LiquidityPoolKeys[]> {
  const response = await fetch("https://api.raydium.io/v2/sdk/liquidity/mainnet.json");
  if (!(await response).ok) return [];
  const json = await response.json();
  const poolsKeysJson = [...(json?.official ?? []), ...(json?.unOfficial ?? [])];
  const poolsKeys = poolsKeysJson.map((item) => {
    const {
      id,
      baseMint,
      quoteMint,
      lpMint,
      baseDecimals,
      quoteDecimals,
      lpDecimals,
      version,
      programId,
      authority,
      openOrders,
      targetOrders,
      baseVault,
      quoteVault,
      withdrawQueue,
      lpVault,
      marketVersion,
      marketProgramId,
      marketId,
      marketAuthority,
      marketBaseVault,
      marketQuoteVault,
      marketBids,
      marketAsks,
      marketEventQueue,
    } = jsonInfo2PoolKeys(item);
    return {
      id,
      baseMint,
      quoteMint,
      lpMint,
      baseDecimals,
      quoteDecimals,
      lpDecimals,
      version,
      programId,
      authority,
      openOrders,
      targetOrders,
      baseVault,
      quoteVault,
      withdrawQueue,
      lpVault,
      marketVersion,
      marketProgramId,
      marketId,
      marketAuthority,
      marketBaseVault,
      marketQuoteVault,
      marketBids,
      marketAsks,
      marketEventQueue,
    };
  });
  return poolsKeys;
}

export async function getRouteRelated(
  connection: Connection,
  tokenInMint: PublicKey,
  tokenOutMint: PublicKey,
): Promise<LiquidityPoolKeys[]> {
  if (!tokenInMint || !tokenOutMint) return [];
  const tokenInMintString = tokenInMint.toBase58();
  const tokenOutMintString = tokenOutMint.toBase58();
  const allPoolKeys = await fetchAllPoolKeys();

  const routeMiddleMints: any[] = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    "So11111111111111111111111111111111111111112",
    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    "Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS",
    "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj",
    "USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  ];
  const candidateTokenMints = routeMiddleMints.concat([tokenInMintString, tokenOutMintString]);
  const onlyRouteMints = routeMiddleMints.filter(
    (routeMint) => ![tokenInMintString, tokenOutMintString].includes(routeMint),
  );
  const routeRelated = allPoolKeys.filter((info: any) => {
    const isCandidate =
      candidateTokenMints.includes(info.baseMint.toBase58()) && candidateTokenMints.includes(info.quoteMint.toBase58());
    const onlyInRoute =
      onlyRouteMints.includes(info.baseMint.toBase58()) && onlyRouteMints.includes(info.quoteMint.toBase58());
    return isCandidate && !onlyInRoute;
  });
  return routeRelated;
}

export async function getTokensInfo() {
  const raw_tokens = await (await fetch("https://cache.jup.ag/tokens")).json();
  const token_map = new Map<string, PublicKey>();
  for (let token of raw_tokens) {
    if (token["chainId"] === 101) {
      token_map.set(token["symbol"], new PublicKey(token["address"]));
    }
  }
  return token_map;
}

export async function getVaultOwnerAndNonce(marketAddress: PublicKey, dexProgramId: PublicKey) {
  const nonce = new BN(0);
  while (nonce.toNumber() < 255) {
    try {
      const vaultOwner = await PublicKey.createProgramAddress(
        [marketAddress.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
        dexProgramId,
      );
      return vaultOwner;
    } catch (e) {
      // console.log(`pda not found for nonce: ${nonce.toNumber()}`);
      nonce.iaddn(1);
    }
  }
  // console.log(`pda not found for nonce: ${nonce.toNumber()}`);
  throw new Error("Unable to find nonce");
}

export async function getAssociatedTokenAddress(
  associatedProgramId: PublicKey,
  programId: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
) {
  return (
    await PublicKey.findProgramAddress([owner.toBuffer(), programId.toBuffer(), mint.toBuffer()], associatedProgramId)
  )[0];
}

export function getMarketSymbol(tokenA: string, tokenB: string) {
  return `${tokenA}-${tokenB}`;
}

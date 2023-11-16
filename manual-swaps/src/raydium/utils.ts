import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  SPL_ACCOUNT_LAYOUT,
  TokenAccount,
  LiquidityPoolKeys,
  Liquidity,
  TokenAmount,
  Token,
  Percent,
  jsonInfo2PoolKeys,
  LiquidityPoolKeysV4,
} from "@raydium-io/raydium-sdk";
import { logger } from "../../utils/logger";
import { getSolscanLink } from "../../utils/helpers";
import { BuySide, DexException } from "../../utils/types";
import { RAY_PREFIX, RETRY_LIMIT } from "../../utils/constants";


export async function getTokenAccountsByOwner(
  connection: Connection,
  owner: PublicKey
) {
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

async function sendTx(
  connection: Connection,
  transaction: Transaction,
  signers: Array<Signer>
): Promise<void> {

  const recentBlockHash = (await connection.getLatestBlockhash("singleGossip")).blockhash;
  transaction.recentBlockhash = recentBlockHash;
  transaction.sign(...signers);

  let txRetry = 0;
  while (++txRetry <= RETRY_LIMIT) {
    try {
      const txID = await sendAndConfirmTransaction(
        connection,
        transaction,
        signers
      );
      logger.info(`${RAY_PREFIX} Swap successful: ${getSolscanLink(txID)}`);
      return;
    } 
    catch (err) {
      const dexError = err as DexException;
      if (dexError.logs) {
        throw new Error(
          `${RAY_PREFIX} Transaction execution failed: ${dexError.logs.join(
            "\n"
          )}`
        );
      } else {
        throw new Error(
          `${RAY_PREFIX} Transaction execution failed: ${dexError}`
        );
      }
    }
  }
}

export async function swap(
  connection: Connection,
  poolKeys: LiquidityPoolKeys,
  ownerKeypair: Keypair,
  swapAmount: number,
  slippage: number,
  side: BuySide
) {
  logger.info(`${RAY_PREFIX} Initiating swap`);

  const owner = ownerKeypair.publicKey;
  const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys });
  const tokenAccounts = await getTokenAccountsByOwner(connection, owner);

  const amountIn =
    side == BuySide.Base
      ? new TokenAmount(
          new Token(poolKeys.baseMint, poolInfo.baseDecimals),
          swapAmount,
          false
        )
      : new TokenAmount(
          new Token(poolKeys.quoteMint, poolInfo.quoteDecimals),
          swapAmount,
          false
        );

  const currencyOut =
    side == BuySide.Base
      ? new Token(poolKeys.quoteMint, poolInfo.quoteDecimals)
      : new Token(poolKeys.baseMint, poolInfo.baseDecimals); 

  const { amountOut, minAmountOut } =
    Liquidity.computeAmountOut({
      poolKeys,
      poolInfo,
      amountIn,
      currencyOut,
      slippage: new Percent(slippage, 100)
    });

  logger.info(
    `${RAY_PREFIX} Expected output amount: ${amountOut.toFixed()} | Minimum amount: ${minAmountOut.toFixed()}`
  );

  const { transaction, signers } = await Liquidity.makeSwapTransaction({
    connection,
    poolKeys,
    userKeys: {
      tokenAccounts,
      owner,
    },
    amountIn,
    amountOut: minAmountOut,
    fixedSide: "in",
  });

  await sendTx(connection, transaction, [ownerKeypair, ...signers]);
  return amountOut.toFixed();
}

async function fetchAllPoolKeys(): Promise<LiquidityPoolKeys[]> {
  const importDynamic = new Function("modulePath", "return import(modulePath)");
  const fetch = async (...args: any[]) => {
    const module = await importDynamic("node-fetch");
    return module.default(...args);
  };

  const response = await fetch(
    "https://api.raydium.io/v2/sdk/liquidity/mainnet.json"
  );
  if (!(await response).ok) return [];
  const json = await response.json();
  const poolsKeysJson = [
    ...(json?.official ?? []),
    ...(json?.unOfficial ?? []),
  ];
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

export async function getPoolKeys(poolAddress: string): Promise<LiquidityPoolKeysV4> {
  const allPoolKeys = await fetchAllPoolKeys();
  const poolKeys = allPoolKeys.find(
    (pool) => pool.id.toBase58() === poolAddress
  );

  if (!poolKeys) {
    throw new Error(`${RAY_PREFIX} Pool key for given pair not found!`)
  }
  return poolKeys;
}
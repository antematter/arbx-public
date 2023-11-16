import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { OpenOrders } from "@project-serum/serum";
import fetch from "cross-fetch";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WRAPPED_SOL_MINT } from "../constants";
import BN from "bn.js";

export const MAINNET_SERUM_DEX_PROGRAM = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID: PublicKey = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export async function findSerumOpenOrdersForOwner(connection: Connection, userPublicKey: PublicKey) {
  const newMarketToOpenOrdersAddress = new Map<string, PublicKey>();
  if (userPublicKey) {
    const programId = MAINNET_SERUM_DEX_PROGRAM;
    const allOpenOrders = await OpenOrders.findForOwner(connection, userPublicKey, programId);
    allOpenOrders.forEach((openOrders) => {
      newMarketToOpenOrdersAddress.set(openOrders.market.toString(), openOrders.address);
    });
  }
  return newMarketToOpenOrdersAddress;
}

export const getMintSymbolMap = async () => {
  const raw_tokens = await (await fetch("https://cache.jup.ag/tokens")).json();
  const token_map = new Map<string, PublicKey>();
  for (let token of raw_tokens) {
    if (token["chainId"] === 101) {
      token_map.set(token["symbol"], new PublicKey(token["address"]));
    }
  }
  const mints_tokens = new Map<string, string>();
  for (let [key, value] of token_map) {
    mints_tokens.set(value.toString(), key);
  }
  return mints_tokens;
};

export const getTokenMintMap = async () => {
  const raw_tokens = await (await fetch("https://cache.jup.ag/tokens")).json();
  const token_map = new Map<string, PublicKey>();
  for (let token of raw_tokens) {
    if (token["chainId"] === 101) {
      token_map.set(token["symbol"], new PublicKey(token["address"]));
    }
  }
  return token_map;
};

export function copyMap<Key, Value>(srcMap: Map<Key, Value>, dstMap: Map<Key, Value>) {
  for (let [key, val] of srcMap) {
    dstMap.set(key, val);
  }
}

export function marketCacheToAccountInfo(marketsCache: Array<any>) {
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

export async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey,
): Promise<PublicKey> {
  return (
    await PublicKey.findProgramAddress(
      [walletAddress.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMintAddress.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )
  )[0];
}

// const { TOKEN_PROGRAM_ID, Token } = require('@solana/spl-token');
// const { Transaction, SystemProgram } = require('@solana/web3.js');
// const { SOL_MINT, WRAPPED_SOL_MINT } = require('../pubkeys');

export async function wrapSol(
  connection: Connection,
  authority: Keypair,
  wrappedSolAccount: Keypair,
  fromMint: PublicKey,
  amount: BN,
) {
  const tx = new Transaction();
  const signers = [wrappedSolAccount];

  // Create new, rent exempt account.
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: wrappedSolAccount.publicKey,
      lamports: await Token.getMinBalanceRentForExemptAccount(connection),
      space: 165,
      programId: TOKEN_PROGRAM_ID,
    }),
  );
  // Transfer lamports. These will be converted to an SPL balance by the
  // token program.
  if (fromMint.equals(WRAPPED_SOL_MINT)) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: wrappedSolAccount.publicKey,
        lamports: amount.toNumber(),
      }),
    );
  }
  // Initialize the account.
  tx.add(
    Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID,
      WRAPPED_SOL_MINT,
      wrappedSolAccount.publicKey,
      authority.publicKey,
    ),
  );
  return { tx, signers };
}

export function unwrapSol(owner: PublicKey, wrappedSolAccount: Keypair) {
  const tx = new Transaction();
  tx.add(Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, wrappedSolAccount.publicKey, owner, owner, []));
  return { tx, signers: [] };
}

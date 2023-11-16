import { AddressLookupTableProgram, Connection, Keypair, PublicKey, Signer, Transaction } from "@solana/web3.js";
import { Market, OpenOrders } from "@project-serum/serum";
import { Swap } from "@project-serum/swap";
import { unwrapSol, wrapSol } from "./utils";

import { Side, SerumSwapParams, SerumSwapInstruction } from "../types";
import { TokenListProvider } from "@solana/spl-token-registry";
import { AnchorProvider, Wallet } from "@project-serum/anchor";
import { BN } from "bn.js";
import { DataStore } from "../dataStore";
import { MAINNET_SERUM_DEX_PROGRAM, WRAPPED_SOL_MINT, PERCENT_INPUT_SERUM, SERUM_FEE } from "../constants";
import { getMarketSymbol } from "../utils";
import logger from "../logger";

let SWAP_CLIENT: Swap | null = null;

export async function createSerumSwapInstruction(
  connection: Connection,
  payer: Keypair,
  ds: DataStore,
  params: SerumSwapParams,
  wrapSolMint?: PublicKey,
): Promise<SerumSwapInstruction> {
  if (SWAP_CLIENT === null) {
    const provider = new AnchorProvider(connection, new Wallet(payer), {
      preflightCommitment: "confirmed",
      commitment: "confirmed",
    });
    const tokenList = await new TokenListProvider().resolve();
    SWAP_CLIENT = new Swap(provider, tokenList);
  }

  const fromMint = params.leg.side === Side.Ask ? params.leg.baseMint : params.leg.quoteMint;
  const fromMintDecimals = params.leg.side === Side.Ask ? params.leg.baseMintDecimals : params.leg.quoteMintDecimals;

  const toMint = params.leg.side === Side.Ask ? params.leg.quoteMint : params.leg.baseMint;
  const toMintDecimals = params.leg.side === Side.Ask ? params.leg.quoteMintDecimals : params.leg.baseMintDecimals;

  const marketSymbol = getMarketSymbol(
    ds.mintTokens.get(params.leg.baseMint.toString())!,
    ds.mintTokens.get(params.leg.quoteMint.toString())!,
  );

  const targetMarket: Market = ds.serumMarketKeys.get(marketSymbol)!;

  let fromWalletAddr = ds.tokenAccounts.get(fromMint.toString());
  let toWalletAddr = ds.tokenAccounts.get(toMint.toString());

  const wrappedSolAccount = Keypair.generate();

  const fromWalletAddress = fromMint.equals(WRAPPED_SOL_MINT)
    ? wrapSolMint
      ? wrapSolMint
      : wrappedSolAccount.publicKey
    : fromWalletAddr!;

  const toWalletAddress = toMint.equals(WRAPPED_SOL_MINT)
    ? wrapSolMint
      ? wrapSolMint
      : wrappedSolAccount.publicKey
    : toWalletAddr!;

  //If any of from or to wallet is undefined, we need to create it and add it to our cache.
  if (!fromWalletAddress || !toWalletAddress) {
    logger.info(`From wallet or toWallet does not exist`);
  }

  let openOprderAcc = ds.serumOpenOrdersAccounts.get(targetMarket.address.toString());
  const ooSigner: Signer[] = [];

  //If open order accounts does not exist for a pair,
  //we will skip the arb and only create the oo and populate LUTs first
  if (!openOprderAcc) {
    const tx = new Transaction();
    logger.info(`Open order does not exist for ${marketSymbol}`);

    const ooAddress = Keypair.generate();
    tx.add(
      //adding instruction in the transaction to create oo account
      await OpenOrders.makeCreateAccountTransaction(
        connection,
        ds.serumMarketKeys.get(marketSymbol)!.address,
        payer.publicKey,
        ooAddress.publicKey,
        MAINNET_SERUM_DEX_PROGRAM,
      ),
    );
    openOprderAcc = ooAddress.publicKey;
    ooSigner.push(ooAddress);
    //caching the newly created oo account
    ds.updateOpenOrderCache(targetMarket.address, ooAddress.publicKey);

    tx.add(
      //extending the lut with the oo account
      AddressLookupTableProgram.extendLookupTable({
        payer: payer.publicKey,
        authority: payer.publicKey,
        lookupTable: params.lutAddress,
        addresses: [ooAddress.publicKey],
      }),
    );
    return {
      openOrderTx: tx,
      signers: ooSigner,
    };
  }
  const inputSwapAmount = new BN(params.inputAmount * 10 ** fromMintDecimals);
  const fare = 1 / params.routeFare;

  const swapTx = await SWAP_CLIENT?.swapTxs({
    fromMint: fromMint,
    toMint: toMint,
    amount: inputSwapAmount,
    minExchangeRate: {
      rate: new BN(10 ** toMintDecimals / fare).muln(100 - params.slippage).divn(100),
      fromDecimals: fromMintDecimals,
      quoteDecimals: toMintDecimals,
      strict: false,
    },
    referral: undefined,
    fromMarket: targetMarket,
    fromOpenOrders: openOprderAcc,
    fromWallet: fromWalletAddress,
    toWallet: toWalletAddress,
  });

  const signers: Signer[] = [];
  let wrapSolTx, unwrapSolTx;

  const isSol = fromMint.equals(WRAPPED_SOL_MINT) || toMint.equals(WRAPPED_SOL_MINT);
  let wrapSolAccTemp: PublicKey | undefined;
  if (isSol && !wrapSolMint) {
    //if one of the mint in the swap leg is SOL, we create a new sol account for that
    const { tx: wrapTx, signers: wrapSigners } = await wrapSol(
      connection,
      payer,
      wrappedSolAccount,
      fromMint,
      inputSwapAmount,
    );
    const { tx: unwrapTx, signers: unwrapSigners } = unwrapSol(payer.publicKey, wrappedSolAccount);

    wrapSolTx = wrapTx;
    unwrapSolTx = unwrapTx;

    signers.push(...wrapSigners);
    signers.push(...unwrapSigners);
    wrapSolAccTemp = wrappedSolAccount.publicKey;
  }
  const outAmount: number = params.inputAmount * params.routeFare * (1 - SERUM_FEE);
  swapTx.forEach((tx) => {
    tx.signers.forEach((signer) => {
      signers.push(signer!);
    });
  });
  return {
    serumSwapTxs: [...swapTx!].map((tx) => tx.tx),
    signers: signers,
    outAmount: outAmount,
    wrapWSOLTx: wrapSolTx,
    unwrapWSOLTx: unwrapSolTx,
    wrapSolMint: wrapSolAccTemp,
  };
}

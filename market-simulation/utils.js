const serumCmn = require("@project-serum/common");
const chalk = require("chalk");

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
    skipPreflight: false,
    maxRetries: 5,
  });
  return [await connection.confirmTransaction(tx, commitment), tx];
}

function extractAddresses(swapAccounts) {
  const addresses = [];
  addresses.push(swapAccounts["pcWallet"]);
  addresses.push(swapAccounts["authority"]);
  addresses.push(swapAccounts["dexProgram"]);
  addresses.push(swapAccounts["tokenProgram"]);
  addresses.push(swapAccounts["rent"]);
  for (const key in swapAccounts["market"]) {
    addresses.push(swapAccounts["market"][key]);
  }
  return addresses;
}

async function printTokenBalance(provider, cache, names) {
  for (let i = 0; i < names.length; i += 1) {
    console.log(chalk.blueBright(`${names[i]} Balance: ${((await serumCmn.getTokenAccount(provider, cache[names[i]]['vault'])).amount)/(10 ** 6)}`));
  }
}

function createAskListings(startPrice, priceDelta=0.01) {
  const asks = [];
  let price = startPrice;
  const VOLUME = 10.0;
  for(let i = 0; i < 10; i++){
    asks.push([price,VOLUME*(i+1)]);
    price+= priceDelta;
  }
  return asks;
}

function createBidListings(startPrice, priceDelta=0.01){
  const bids = [];
  let price = startPrice;
  const VOLUME = 10.0;
  for(let i = 0; i < 10; i++){
    bids.push([price,VOLUME*(i+1)]);
    price-= priceDelta;
  }
  return bids;
}

module.exports = {
  signTransactions,
  sendAndConfirmRawTransaction,
  extractAddresses,
  printTokenBalance,
  createAskListings,
  createBidListings
};

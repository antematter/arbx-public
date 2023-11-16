const splToken = require("@solana/spl-token");
const web3 = require("@solana/web3.js");
const {JUPITER_PROGRAM} = require("../jupiter");
const JSBI = require("jsbi");
const BN = require('bn.js');
const optimist = require("@mercurial-finance/optimist");
const math = require("@jup-ag/math");


const utils = require("../utils");
const Owner = utils.Owner;
const Constants = require("../constants");
const Amms = require("../amms");
const SwapMode = Amms.SwapMode;

const {TransactionBuilder} = require('./TransactionBuilder');

function _interopDefaultLegacy(e) {
  return e && typeof e === "object" && "default" in e ? e : { default: e };
}

const JSBI__default = _interopDefaultLegacy(JSBI);
const SEND_OPTIONS = {
  skipPreflight: true,
  maxRetries: 2
};

const wait = time => new Promise(resolve => setTimeout(resolve, time));

class SplitTradeAmm{

};

async function createAndCloseWSOLAccount({
  connection,
  amount,
  owner: { publicKey },
}) {
  const result = utils.getEmptyInstruction();
  result.instructions = [];
  const toAccount = await splToken.Token.getAssociatedTokenAddress(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    Constants.WRAPPED_SOL_MINT,
    publicKey,
    true
  );
  const info = await connection.getAccountInfo(toAccount);

  if (info === null) {
    result.instructions.push(
      utils.createAssociatedTokenAccountInstruction(
        publicKey,
        toAccount,
        publicKey,
        Constants.WRAPPED_SOL_MINT
      )
    );
  } // Fund account and sync

  result.instructions.push(
    web3.SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: toAccount,
      lamports: JSBI__default["default"].toNumber(amount),
    })
  );
  result.instructions.push(
    // This is not exposed by the types, but indeed it exists
    splToken.Token.createSyncNativeInstruction(
      splToken.TOKEN_PROGRAM_ID,
      toAccount
    )
  );
  result.cleanupInstructions = [
    splToken.Token.createCloseAccountInstruction(
      splToken.TOKEN_PROGRAM_ID,
      toAccount,
      publicKey,
      publicKey,
      []
    ),
  ];
  return {
    address: toAccount,
    ...result,
  };
}

async function makeSourceInstruction(
  wrapUnwrapSOL,
  connection,
  owner,
  routeInfo,
  inputMint
) {
  const WRAPPED_SOL_MINT = Constants.WRAPPED_SOL_MINT;
  return inputMint.equals(WRAPPED_SOL_MINT) && wrapUnwrapSOL
    ? await createAndCloseWSOLAccount({
        connection,
        owner,
        amount:
          routeInfo.swapMode === SwapMode.ExactIn
            ? routeInfo.inAmount
            : routeInfo.otherAmountThreshold,
      })
    : await splToken.Token.getAssociatedTokenAddress(
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        splToken.TOKEN_PROGRAM_ID,
        inputMint,
        owner.publicKey,
        true
      ).then((address) => ({ ...utils.getEmptyInstruction(), address }));
}


function isSerumAndRaydium(marketInfos) {
  if (marketInfos.length < 2) return false;
  const [firstAmm, secondAmm] = marketInfos.map((mi) => mi.amm);
  return (
    (firstAmm instanceof Amms.RaydiumAmm &&
      secondAmm instanceof Amms.SerumAmm) ||
    (firstAmm instanceof Amms.SerumAmm && secondAmm instanceof Amms.RaydiumAmm)
  );
}

function createSetTokenLedgerInstruction(tokenLedger, tokenAccountAddress) {
  return JUPITER_PROGRAM.instruction.setTokenLedger({
    accounts: {
      tokenLedger,
      tokenAccount: tokenAccountAddress,
    },
  });
}
  

async function routeToInstructions({
    user,
    tokenLedger,
    openOrdersAddresses,
    userSourceTokenAccountAddress,
    userIntermediaryTokenAccountAddress,
    userDestinationTokenAccountAddress,
    routeInfo,
    platformFee,
    quoteMintToReferrer
  }) {
    const otherAmountThreshold = routeInfo.otherAmountThreshold;
    const amount = routeInfo.amount;
    const legs = routeInfo.marketInfos.length;
  
    if (legs === 2 && !userIntermediaryTokenAccountAddress) {
      throw new Error('Missing intermediary token account');
    } // Drop referrer if space is scarce
  
  
    const effectiveQuoteMintToReferrer = platformFee && isSerumAndRaydium(routeInfo.marketInfos) ? undefined : quoteMintToReferrer;
    const userIntermediateTokenAccountAddresses = userIntermediaryTokenAccountAddress ? [userIntermediaryTokenAccountAddress] : [];
    const userTokenAccountAddresses = [userSourceTokenAccountAddress, ...userIntermediateTokenAccountAddresses, userDestinationTokenAccountAddress];
    console.log(`userTokenAccountAddresses: ${userTokenAccountAddresses}`);
    const platformFeeSupported = utils.isPlatformFeeSupported(routeInfo.swapMode, routeInfo.marketInfos.map(mi => mi.amm));
    const instructions = [createSetTokenLedgerInstruction(tokenLedger, userTokenAccountAddresses[1])];
    
    console.log(`created 4 instructions`);
    for (const [index, marketInfo] of routeInfo.marketInfos.entries()) {
      const amm = marketInfo.amm;
      const legAmount = index === 0 ? new BN.BN(amount.toString()) : null;
      const isLastLeg = index === legs - 1;
      const legOtherAmountThreshold = new BN.BN((isLastLeg ? otherAmountThreshold : math.ZERO).toString());
      const legPlatformFee = isLastLeg && platformFeeSupported ? platformFee : undefined;
      const [userSourceTokenAccount, userDestinationTokenAccount] = userTokenAccountAddresses.slice(index);
      console.log(`creating swap instruction for ${amm.label}`);
      instructions.push(...amm.createSwapInstructions({
        sourceMint: marketInfo.inputMint,
        destinationMint: marketInfo.outputMint,
        userSourceTokenAccount,
        userDestinationTokenAccount,
        userTransferAuthority: user.publicKey,
        amount: legAmount,
        otherAmountThreshold: legOtherAmountThreshold,
        swapMode: routeInfo.swapMode,
        tokenLedger,
        openOrdersAddress: openOrdersAddresses[index],
        platformFee: legPlatformFee,
        quoteMintToReferrer: effectiveQuoteMintToReferrer
      }));
      console.log(`created swap instruction for ${amm.label}`);
    }
  
    const {
      signers,
      cleanupInstructions
    } = utils.getEmptyInstruction();
  
    if (user.isKeyPair && user.signer) {
      signers.push(user.signer);
    }
  
    return {
      signers,
      cleanupInstructions,
      instructions
    };
  }


  function isSplitSetupRequired(marketInfos, {
    hasSerumOpenOrderInstruction
  }) {
    let firstAmm;
    let secondAmm;
  
    if (marketInfos.length === 1) {
      const amm = marketInfos[0].amm;
  
      if (amm instanceof SplitTradeAmm) {
        firstAmm = amm.firstAmm;
        secondAmm = amm.secondAmm;
      } else {
        return {
          needSetup: false,
          needCleanup: false
        };
      }
    } else {
      [firstAmm, secondAmm] = marketInfos.map(marketInfo => marketInfo.amm);
    }
  
    if (firstAmm instanceof Amms.RaydiumAmm || secondAmm instanceof Amms.RaydiumAmm) {
      return {
        needSetup: true,
        needCleanup: true
      };
    } else if (firstAmm instanceof Amms.SerumAmm && secondAmm instanceof Amms.SerumAmm) {
      return {
        needSetup: true,
        needCleanup: true
      };
    } else if (hasSerumOpenOrderInstruction) {
      return {
        needSetup: true,
        needCleanup: false
      };
    }
  
    return {
      needSetup: false,
      needCleanup: false
    };
  } 


  async function validateTransactionResponse({
    txid,
    transactionResponse
  }) {
    var _transactionResponse$;
  
    if (!transactionResponse) {
      throw new optimist.TransactionError('Transaction was not confirmed', txid);
    }
  
    if (transactionResponse !== null && transactionResponse !== void 0 && (_transactionResponse$ = transactionResponse.meta) !== null && _transactionResponse$ !== void 0 && _transactionResponse$.err) {
      let {
        message,
        code
      } = await optimist.parseErrorForTransaction(transactionResponse);
  
      switch (code) {
        case 6000:
          {
            message = 'Slippage error';
          }
  
        default:
          {
            message = optimist.UNKNOWN_ERROR;
          }
      }
  
      throw new optimist.TransactionError(message || '', txid, code);
    }
  
    return {
      txid,
      transactionResponse
    };
  }

  function getSignature(transaction) {
    const signature = transaction.signature;
  
    if (!signature) {
      throw new Error('Transaction has no signature');
    }
  
    return bytes.bs58.encode(signature);
  }

  function getUnixTs() {
    return new Date().getTime();
  }



function diffTokenBalance(accountKeyIndex, meta) {
  var _meta$postTokenBalanc, _meta$postTokenBalanc2, _meta$preTokenBalance, _meta$preTokenBalance2;

  const postBalance = (_meta$postTokenBalanc = meta.postTokenBalances) === null || _meta$postTokenBalanc === void 0 ? void 0 : (_meta$postTokenBalanc2 = _meta$postTokenBalanc.find(postTokenBalance => postTokenBalance.accountIndex === accountKeyIndex)) === null || _meta$postTokenBalanc2 === void 0 ? void 0 : _meta$postTokenBalanc2.uiTokenAmount.amount;
  const preBalance = (_meta$preTokenBalance = meta.preTokenBalances) === null || _meta$preTokenBalance === void 0 ? void 0 : (_meta$preTokenBalance2 = _meta$preTokenBalance.find(preTokenBalance => preTokenBalance.accountIndex === accountKeyIndex)) === null || _meta$preTokenBalance2 === void 0 ? void 0 : _meta$preTokenBalance2.uiTokenAmount.amount; // When token account is created it isn't present in preBalance

  if (!postBalance) return;
  return Math.abs(parseInt(postBalance) - (preBalance !== undefined ? parseInt(preBalance) : 0));
}

  function extractTokenBalanceChangeFromTransaction(meta, transaction, tokenAccountAddress) {
    const message = transaction.message;
  
    if (!meta) {
      return;
    }
  
    const index = message.accountKeys.findIndex(p => p.equals(tokenAccountAddress));
    return diffTokenBalance(index, meta);
  }

  async function transactionSenderAndConfirmationWaiter(connection, signedTransaction, timeout = 120000, // 2 minutes, (sendInterval * sendRetries) = 80_000 + extra wait 40_000
  pollInterval = 500, sendInterval = 2000, sendRetries = 40) {
    const rawTransaction = signedTransaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, SEND_OPTIONS);
    console.log(`Tx id: ${txid}`);
    const start = getUnixTs();
    let lastSendTimestamp = getUnixTs();
    let retries = 0;
  
    while (getUnixTs() - start < timeout) {
      const timestamp = getUnixTs();
  
      if (retries < sendRetries && timestamp - lastSendTimestamp > sendInterval) {
        lastSendTimestamp = timestamp;
        retries += 1;
        await connection.sendRawTransaction(rawTransaction, SEND_OPTIONS);
        console.log(`[Sending again] Tx id: ${txid}`);

      }
      console.log(`Waiting for transaction status`);
      let response = undefined;
      try {
        response = await Promise.any([connection.getTransaction(txid, {
          commitment: 'confirmed'
        }), wait(5000)]);
      } catch (error) {
        console.log(`Error confirming transaction: ${error}`);
      }
     
      console.log(`Wait over for transaction status`);

      if (response) {
        console.log(`Transaction execution response: ${JSON.stringify(response)}`);
          return {
          txid,
          transactionResponse: response,
        };
      }
      await wait(pollInterval);
    }
    
    return {
      txid,
      transactionResponse: null
    };
  }

  function extractSOLChangeFromTransaction(meta, transaction, user) {
    let accountKeyIndex = transaction.message.accountKeys.findIndex(p => p.equals(user));
  
    if (accountKeyIndex !== -1) {
      return Math.abs(meta.postBalances[accountKeyIndex] - meta.preBalances[accountKeyIndex]);
    } // if 0 is returned it will throw error in the caller function
  
  
    return 0;
  }

  function getTokenBalanceChangesFromTransactionResponse({
    txid,
    inputMint,
    outputMint,
    user,
    sourceAddress,
    destinationAddress,
    transactionResponse,
    hasWrappedSOL
  }) {
    let sourceTokenBalanceChange;
    let destinationTokenBalanceChange;
  
    if (transactionResponse) {
      let {
        meta,
        transaction
      } = transactionResponse;
  
      if (meta) {
        sourceTokenBalanceChange = inputMint.equals(Constants.WRAPPED_SOL_MINT) && !hasWrappedSOL ? extractSOLChangeFromTransaction(meta, transaction, user) : extractTokenBalanceChangeFromTransaction(meta, transaction, sourceAddress);
        destinationTokenBalanceChange = outputMint.equals(Constants.WRAPPED_SOL_MINT) && !hasWrappedSOL ? extractSOLChangeFromTransaction(meta, transaction, user) : extractTokenBalanceChangeFromTransaction(meta, transaction, destinationAddress);
      }
    }
  
    if (!(sourceTokenBalanceChange && destinationTokenBalanceChange)) {
      throw new optimist.TransactionError('Cannot find source or destination token account balance change', txid, JUPITER_ERRORS['BalancesNotExtractedProperly'].code);
    }
  
    return [sourceTokenBalanceChange, destinationTokenBalanceChange];
  }

async function executeInternal({
    connection,
    wallet,
    onTransaction,
    inputMint,
    outputMint,
    sourceInstruction,
    setupInstructions,
    setupTransaction,
    swapTransaction,
    cleanupTransaction,
    owner,
    wrapUnwrapSOL
  }) {
    try {
      const transactions = [setupTransaction, swapTransaction, cleanupTransaction].filter(tx => tx !== undefined);
      const totalTxs = transactions.length;

      if (owner.signer) {
        const signer = owner.signer;
        transactions.forEach(transaction => {
          transaction.sign(signer);
        });
      } else {
        if (!wallet) {
          throw new Error('Signer wallet not found');
        }

        if (totalTxs > 1) {
          await wallet.signAllTransactions(transactions);
        } else {
          await wallet.signTransaction(transactions[0]);
        }
      }

      if (setupTransaction) {
        onTransaction === null || onTransaction === void 0 ? void 0 : onTransaction(getSignature(setupTransaction), totalTxs, 'SETUP');
        await validateTransactionResponse(await transactionSenderAndConfirmationWaiter(connection, setupTransaction));
      }

      onTransaction === null || onTransaction === void 0 ? void 0 : onTransaction(getSignature(swapTransaction), totalTxs, 'SWAP');
      let swapError;
      let swapResult = undefined;

      try {
        const {
          txid,
          transactionResponse
        } = await validateTransactionResponse(await transactionSenderAndConfirmationWaiter(connection, swapTransaction));
        const [sourceTokenBalanceChange, destinationTokenBalanceChange] = getTokenBalanceChangesFromTransactionResponse({
          txid,
          inputMint,
          outputMint,
          user: owner.publicKey,
          sourceAddress: sourceInstruction.address,
          destinationAddress: setupInstructions.destination.address,
          transactionResponse,
          hasWrappedSOL: Boolean(cleanupTransaction) || !wrapUnwrapSOL
        });
        swapResult = {
          txid,
          inputAddress: sourceInstruction.address,
          outputAddress: setupInstructions.destination.address,
          inputAmount: sourceTokenBalanceChange,
          outputAmount: destinationTokenBalanceChange
        };
      } catch (e) {
        swapError = e;
      } finally {
        if (cleanupTransaction) {
          onTransaction === null || onTransaction === void 0 ? void 0 : onTransaction(getSignature(cleanupTransaction), totalTxs, 'CLEANUP'); // wait for confirmation but swallow error to conserve behaviour

          await transactionSenderAndConfirmationWaiter(connection, cleanupTransaction);
        }
      }

      if (swapError || !swapResult) {
        throw swapError || new Error('Swap failed');
      } // return must be after `finally` clause to ensure we wait what we done in the `finally`


      return swapResult;
    } catch (error) {
      return {
        error: error
      };
    } finally {
    }
  }

async function performSwap(
  connection,
  serumOpenOrdersPromise,
  routeInfo,
  userPublicKey,
  feeAccount,
  wrapUnwrapSOL,
  quoteMintToReferrer
) {
  var _instructions$interme;

  const tokenLedger = Constants.TOKEN_LEDGER;
  const user = userPublicKey;

  if (!user) {
    throw new Error("user not found");
  }

  const owner = new Owner(user);

  const lastMarketInfoIndex = routeInfo.marketInfos.length - 1;
  const inputMint = routeInfo.marketInfos[0].inputMint;
  const outputMint = routeInfo.marketInfos[lastMarketInfoIndex].outputMint;

  // console.log(`lastMarketInfoIndex: ${lastMarketInfoIndex}`);
  // console.log(`input mint: ${inputMint}`);
  // console.log(`output mint: ${outputMint}`);

  // process.exit(-1);

  const _wrapUnwrapSOL = wrapUnwrapSOL;
  // console.log(`Status of condition: ${inputMint.equals(WRAPPED_SOL_MINT) && _wrapUnwrapSOL}`);

  console.log(`routeInfo.swapMode: ${routeInfo.swapMode}`);
  console.log(`routeInfo.inAmount: ${routeInfo.inAmount}`);
  console.log(
    `routeInfo.otherAmountThreshold: ${routeInfo.otherAmountThreshold}`
  );

  // process.exit(-1);

  //fetches the address of the associated token account for a given mint and owner

  // const addresses = await splToken.Token.getAssociatedTokenAddress(splToken.ASSOCIATED_TOKEN_PROGRAM_ID, splToken.TOKEN_PROGRAM_ID, inputMint, owner.publicKey, true)
  const [sourceInstruction, ataInstructions, openOrdersInstructions] =
    await Promise.all([
      inputMint.equals(Constants.WRAPPED_SOL_MINT) && _wrapUnwrapSOL
        ? createAndCloseWSOLAccount({ //check if wrapped sol account exists, creates it if it doesn't transfer the amount into it and adds instruction for closing that
            connection,
            owner,
            amount:
              routeInfo.swapMode === SwapMode.ExactIn
                ? routeInfo.inAmount
                : routeInfo.otherAmountThreshold,
          })
        : splToken.Token.getAssociatedTokenAddress( // Get the address of the associated token account for a given mint and owner
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
            splToken.TOKEN_PROGRAM_ID,
            inputMint,
            owner.publicKey,
            true
          ).then((address) => ({ ...utils.getEmptyInstruction(), address })),
      utils.routeAtaInstructions(
        connection,
        routeInfo.marketInfos,
        owner,
        _wrapUnwrapSOL
      ),
      Promise.all(
        routeInfo.marketInfos.map(async ({ amm }) => {
          if (amm instanceof Amms.SerumAmm) {
            if (!amm.market) return;
            console.log(`Creating open orders account`);
            return await utils.getOrCreateOpenOrdersAddress(
              connection,
              owner.publicKey,
              amm.market,
              await serumOpenOrdersPromise
            );
          }

          return;
        })
      ),
    ]);

  const instructions = {
    intermediate: ataInstructions.userIntermediaryTokenAccountResult,
    destination: ataInstructions.userDestinationTokenAccountResult,
    openOrders: openOrdersInstructions,
  };
  const hasOpenOrders = instructions.openOrders.filter(Boolean).length > 0; // Construct platform fee
  console.log(`has open orders: ${hasOpenOrders}`);
  feeAccount = undefined;

  const platformFee = feeAccount
    ? {
        feeBps:
          platformFeeAndAccounts.feeBps ||
          Math.floor(
            routeInfo.marketInfos[lastMarketInfoIndex].platformFee.pct * 100
          ),
        feeAccount,
      }
    : undefined;
  console.log(`platformFee done`);
  const preparedInstructions = await routeToInstructions({
    user: owner,
    tokenLedger: tokenLedger,
    openOrdersAddresses: instructions.openOrders.map((oo) =>
      oo === null || oo === void 0 ? void 0 : oo.address
    ),
    userSourceTokenAccountAddress: sourceInstruction.address,
    userIntermediaryTokenAccountAddress:
      (_instructions$interme = instructions.intermediate) === null ||
      _instructions$interme === void 0
        ? void 0
        : _instructions$interme.address,
    userDestinationTokenAccountAddress: instructions.destination.address,
    routeInfo,
    platformFee,
    quoteMintToReferrer: quoteMintToReferrer,
  });
  console.log(`preparedInstructions done`);
  const { needCleanup, needSetup } = isSplitSetupRequired(
    routeInfo.marketInfos,
    {
      hasSerumOpenOrderInstruction: hasOpenOrders,
    }
  );
  console.log(`need cleanup: ${needCleanup}`);
  console.log(`need setup: ${needSetup}`);
  const setupTransactionBuilder = new TransactionBuilder(
    connection,
    owner.publicKey,
    owner
  );
  const transactionBuilder = new TransactionBuilder(
    connection,
    owner.publicKey,
    owner
  );
  const cleanupTransactionBuilder = new TransactionBuilder(
    connection,
    owner.publicKey,
    owner
  );
  const ixs = [
    instructions.intermediate,
    sourceInstruction, // if source address the same as destination address, then we don't need to setup or cleanup twice, mainly SOL-SOL
    !instructions.destination.address.equals(sourceInstruction.address) &&
      instructions.destination,
  ];

  if (needSetup) {
    if (hasOpenOrders) {
      instructions.openOrders.forEach((openOrders) => {
        if (openOrders) {
          setupTransactionBuilder.addInstruction(openOrders);
        }
      });
    }

    ixs.forEach((instruction) => {
      if (instruction) {
        // we cannot put cleanup here because we cannot do cleanup in setupTransaction
        setupTransactionBuilder.addInstruction({
          ...instruction,
          cleanupInstructions: [],
        });

        if (instruction.cleanupInstructions.length) {
          const cleanupIx = {
            ...utils.getEmptyInstruction(),
            cleanupInstructions: instruction.cleanupInstructions,
          };

          if (needCleanup) {
            cleanupTransactionBuilder.addInstruction(cleanupIx);
          } else {
            transactionBuilder.addInstruction(cleanupIx);
          }
        }
      }
    });
  } else {
    if (hasOpenOrders) {
      instructions.openOrders.forEach((openOrders) => {
        if (openOrders) {
          transactionBuilder.addInstruction(openOrders);
        }
      });
    }

    ixs.forEach((instruction) => {
      if (instruction) {
        transactionBuilder.addInstruction(instruction);
      }
    });
  }

  transactionBuilder.addInstruction(preparedInstructions);
  const recentBlockHash = (
    await connection.getLatestBlockhash("confirmed")
  ).blockhash;
  const { transaction: setupTransaction } = await setupTransactionBuilder.build(
    recentBlockHash
  );
  const { transaction } = await transactionBuilder.build(recentBlockHash);
  const { transaction: cleanupTransaction } =
    await cleanupTransactionBuilder.build(recentBlockHash);
  const [
    setupTransactionObject,
    swapTransactionObject,
    cleanupTransactionObject,
  ] = [
    setupTransaction.instructions.length ? setupTransaction : undefined,
    transaction,
    cleanupTransaction.instructions.length ? cleanupTransaction : undefined,
  ];
  const setupInstructions = instructions;
  console.log(`setupTransactionObject: ${JSON.stringify(setupTransactionObject)}`);
  console.log(`swap Transaction: ${JSON.stringify(swapTransactionObject)}`);
  console.log(`cleanupTransactionObject: ${JSON.stringify(cleanupTransactionObject)}`);


  return {
    transactions: {
      setupTransaction: setupTransactionObject,
      swapTransaction: swapTransactionObject,
      cleanupTransaction: cleanupTransactionObject,
    },
    execute: ({ wallet, onTransaction } = {}) =>
      executeInternal({
        connection,
        wallet,
        onTransaction,
        inputMint,
        outputMint,
        sourceInstruction,
        setupInstructions,
        setupTransaction: setupTransactionObject,
        swapTransaction: swapTransactionObject,
        cleanupTransaction: cleanupTransactionObject,
        wrapUnwrapSOL: _wrapUnwrapSOL,
        owner,
      }),
  };
}

module.exports = {
    performSwap
}
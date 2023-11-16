import { decode } from 'bs58';
import { Jupiter } from '@jup-ag/core';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

import { logExit } from './exit';
import cache from './cache';
import tokensJSON from './data/tokens.json';

const setup = async () => {
  let tokens, tokenA, tokenB, wallet;

  try {
    tokens = tokensJSON;
    tokenA = tokens.find((t) => t.address === cache.config.tokenA.address);

    if (cache.config.tradingStrategy !== 'arbitrage')
      tokenB = tokens.find((t) => t.address === cache.config.tokenB.address);

    if (!cache.config.walletPrivateKey) {
      throw new Error('Wallet check failed!');
    } else {
      wallet = Keypair.fromSecretKey(decode(cache.config.walletPrivateKey));
    }

    const connection = new Connection(cache.config.rpc[0]);
    const jupiter = await Jupiter.load({
      connection,
      cluster: cache.config.network,
      user: wallet,
      restrictIntermediateTokens: true,
      wrapUnwrapSOL: cache.wrapUnwrapSOL,
    });

    cache.isSetupDone = true;
    return { jupiter, tokenA, tokenB };
  } catch (error) {
    logExit(1, error);
  }
};

const getInitialOutAmountWithSlippage = async (
  jupiter,
  inputToken,
  outputToken,
  amountToTrade
) => {
  try {
    const routes = await jupiter.computeRoutes({
      inputMint: new PublicKey(inputToken.address),
      outputMint: new PublicKey(outputToken.address),
      inputAmount: amountToTrade,
      slippage: 0,
      forceFeech: true,
    });

    if (routes?.routesInfos?.length > 0)
      console.log('Routes computed for inital out amount!');
    else
      console.log(
        'No routes found for computing initial out amount. Something is wrong!'
      );

    return routes.routesInfos[0].outAmountWithSlippage;
  } catch (error) {
    console.log('Computing routes for initial out amount failed!');
    logExit(1, error);
  }
};

export { setup, getInitialOutAmountWithSlippage };

const JSBI = require("jsbi");
const splToken = require("@solana/spl-token");
const fetch = require("cross-fetch");
const web3 = require("@solana/web3.js");
const serum = require("@project-serum/serum");
const stableswapSdk = require("@saberhq/stableswap-sdk");

const Constants = require("./constants");
const { MARKETS_URL } = require("./constants");
const utils = require("./utils");
const Amms = require("./amms");
const routeGenerator = require("./routeGenerator");

const SwapMode = Amms.SwapMode;

function _interopDefaultLegacy(e) {
  return e && typeof e === "object" && "default" in e ? e : { default: e };
}

function chunks(array, size) {
  return Array.apply(0, new Array(Math.ceil(array.length / size))).map(
    (_, index) => array.slice(index * size, (index + 1) * size)
  );
}

const JSBI__default = _interopDefaultLegacy(JSBI);

async function fetchMarketCache(url) {
  const marketsCache = await (await fetch(url)).json();
  return marketsCache;
}

async function chunkedGetMultipleAccountInfos(
  connection,
  pks,
  batchChunkSize = 1000,
  maxAccountsChunkSize = 100
) {
  return (
    await Promise.all(
      chunks(pks, batchChunkSize).map(async (batchPubkeys) => {
        const batch = chunks(batchPubkeys, maxAccountsChunkSize).map(
          (pubkeys) => ({
            methodName: "getMultipleAccounts",
            args: connection._buildArgs(
              [pubkeys],
              connection.commitment,
              "base64"
            ),
          })
        );
        return (
          // getMultipleAccounts is quite slow, so we use fetch directly
          connection // @ts-ignore
            ._rpcBatchRequest(batch)
            .then((batchResults) => {
              const accounts = batchResults.reduce((acc, res) => {
                res.result.value.forEach((item) => {
                  if (item) {
                    const value = item;
                    value.data = Buffer.from(item.data[0], item.data[1]);
                    value.owner = new web3.PublicKey(item.owner);
                    acc.push(value);
                  } else {
                    acc.push(null);
                  }
                });
                return acc;
              }, []);
              return accounts;
            })
            .catch((e) => {
              return batchPubkeys.map(() => null);
            })
        );
      })
    )
  ).flat();
}

async function fetchExtraKeyedAccountInfos(connection, pks) {
  const extraKeyedAccountInfos = (
    await chunkedGetMultipleAccountInfos(
      connection,
      pks.map((item) => item.toBase58())
    )
  ).map((item, index) => {
    const pubkey = pks[index];
    if (!item) throw new Error(`Failed to fetch pool ${pubkey.toBase58()}`);
    return {
      pubkey,
      ...item,
    };
  });
  return extraKeyedAccountInfos;
}

const prefetchAmms = async (amms, connection) => {
  const accounts = amms
    .map((amm) => amm.getAccountsForUpdate().map((item) => item.toBase58()))
    .flat();
  const accountInfosMap = new Map();
  const accountInfos = await chunkedGetMultipleAccountInfos(
    connection,
    accounts
  );
  accountInfos.forEach((item, index) => {
    const publicKey = accounts[index];

    if (item) {
      accountInfosMap.set(publicKey, item);
    }
  });

  for (let amm of amms) {    
    amm.update(accountInfosMap);
  }

};

function ammFactory(address, accountInfo, params) {
  const programId = new web3.PublicKey(accountInfo.owner);

  if (
    programId.equals(Constants.MAINNET_SERUM_DEX_PROGRAM) ||
    programId.equals(Constants.DEVNET_SERUM_DEX_PROGRAM)
  ) {
    const decoded = serum.Market.getLayout(programId).decode(accountInfo.data);

    if (!decoded.accountFlags.initialized || !decoded.accountFlags.market) {
      throw new Error("Invalid market");
    }

    const serumMarket = new serum.Market(decoded, 0, 0, {}, programId);
    return new Amms.SerumAmm(serumMarket);
  } else if (programId.equals(Constants.RAYDIUM_AMM_V4_PROGRAM_ID)) {
    const raydiumAmm = new Amms.RaydiumAmm(address, accountInfo, params);

    if (raydiumAmm.status === 1) {
      return raydiumAmm;
    }
  } else if (programId.equals(Constants.MERCURIAL_SWAP_PROGRAM_ID)) {
    return new Amms.MercurialAmm(address, accountInfo, params);
  } else if (programId.equals(stableswapSdk.SWAP_PROGRAM_ID)) {
    const stableSwap = stableswapSdk.StableSwap.loadWithData(
      address,
      accountInfo.data,
      web3.PublicKey.findProgramAddressSync(
        [address.toBuffer()],
        stableswapSdk.SWAP_PROGRAM_ID
      )[0]
    );
    if (stableSwap.state.isPaused || !stableSwap.state.isInitialized) return;
    return new Amms.SaberAmm(stableSwap);
  } else if (programId.equals(Constants.CREMA_PROGRAM_ID)) {
    return new Amms.CremaAmm(address, accountInfo);
  } else if (
    programId.equals(Constants.ALDRIN_SWAP_PROGRAM_ID) ||
    programId.equals(Constants.ALDRIN_SWAP_V2_PROGRAM_ID)
  ) {
    return new Amms.AldrinAmm(address, accountInfo, params);
  } else if (
    [...Constants.PROGRAM_ID_TO_LABEL.keys()].includes(programId.toBase58())
  ) {
    var _PROGRAM_ID_TO_LABEL$;

    const label =
      (_PROGRAM_ID_TO_LABEL$ = Constants.PROGRAM_ID_TO_LABEL.get(
        accountInfo.owner.toBase58()
      )) !== null && _PROGRAM_ID_TO_LABEL$ !== void 0
        ? _PROGRAM_ID_TO_LABEL$
        : "Unknown";
    return new Amms.SplTokenSwapAmm(address, accountInfo, label);
  } else if (programId.equals(Constants.CROPPER_PROGRAM_ID)) {
    return new Amms.CropperAmm(address, accountInfo, params);
  } else if (programId.equals(Constants.SENCHA_PROGRAM_ID)) {
    const senchaAmm = new Amms.SenchaAmm(address, accountInfo);
    if (senchaAmm.isPaused) return;
    return senchaAmm;
  } else if (programId.equals(Constants.LIFINITY_PROGRAM_ID)) {
    return new Amms.LifinityAmm(address, accountInfo);
  } else if (programId.equals(Constants.WHIRLPOOL_PROGRAM_ID)) {
    return new Amms.WhirlpoolAmm(address, accountInfo);
  } else if (programId.equals(Constants.CYKURA_PROGRAM_ID)) {
    return new Amms.CykuraAmm(address, accountInfo);
  } else if (programId.equals(Constants.MARINADE_PROGRAM_ID)) {
    return new Amms.MarinadeAmm(address, accountInfo);
  } // Not supported by frontend

  return;
}

function getSaberWrappedDecimalsAmms() {
  return utils.addDecimalsJson.map((addDecimalJson) => {
    const addDecimals = {
      wrapper: new web3.PublicKey(addDecimalJson.wrapper),
      underlying: new web3.PublicKey(addDecimalJson.underlying),
      underlyingDecimals: addDecimalJson.underlyingDecimals,
      wrapperUnderlyingTokens: new web3.PublicKey(
        addDecimalJson.wrapperUnderlyingTokens
      ),
      mint: new web3.PublicKey(addDecimalJson.mint),
      decimals: addDecimalJson.decimals,
    };
    return new Amms.SaberAddDecimalsAmm(new Amms.WrappedToken(addDecimals));
  });
}

async function getAllAmms(connection, marketsCache) {
  const marketCacheToAccountInfo = (marketsCache) => {
    return marketsCache.map((market) => {
      const {
        data: [accountInfo, format],
        pubkey,
        ...rest
      } = market;
      return {
        ...rest,
        pubkey: new web3.PublicKey(pubkey),
        data: Buffer.from(accountInfo, format),
        owner: new web3.PublicKey(rest.owner),
      };
    });
  };

  const marketKeyedAccountInfos = marketCacheToAccountInfo(marketsCache); // this is used for development

  const extraKeys = [];
  if (extraKeys.length) {
    const extraKeyedAccountInfos = await fetchExtraKeyedAccountInfos(
      connection,
      extraKeys
    );
    marketKeyedAccountInfos.push(...extraKeyedAccountInfos);
  }
  const amms = marketKeyedAccountInfos.reduce((acc, keyedAccountInfo) => {
    const amm = ammFactory(
      keyedAccountInfo.pubkey,
      keyedAccountInfo,
      keyedAccountInfo.params
    ); // Amm might not be recognized by the current version of the frontend
    // or be in a state we don't want

    if (amm) {
      acc.push(amm);
    }

    return acc;
  }, new Array());
  await prefetchAmms(
    amms.filter((amm) => amm.shouldPrefetch),
    connection
  );

  amms.push(...getSaberWrappedDecimalsAmms());
  return amms;
}

function getTwoPermutations(array) {
  return array.reduce((acc, item) => {
    array.forEach((otherItem) => {
      if (item !== otherItem) {
        acc.push([item, otherItem]);
      }
    });
    return acc;
  }, new Array());
}

function addSegment(inMint, outMint, amm, tokenRouteSegments) {
  let segments = tokenRouteSegments.get(inMint);

  if (!segments) {
    segments = new Map([[outMint, []]]);
    tokenRouteSegments.set(inMint, segments);
  }

  let amms = segments.get(outMint);

  if (!amms) {
    amms = [];
    segments.set(outMint, amms);
  }

  amms.push(amm);
}

function getTokenRouteSegments(amms) {
  const tokenRouteSegments = new Map();
  amms.forEach((amm) => {
    const reserveTokenMintPermutations = getTwoPermutations(
      amm.reserveTokenMints
    );
    reserveTokenMintPermutations.forEach(
      ([firstReserveMint, secondReserveMint]) => {
        addSegment(
          firstReserveMint.toBase58(),
          secondReserveMint.toBase58(),
          amm,
          tokenRouteSegments
        );
      }
    );
  });
  return tokenRouteSegments;
}

async function fetchTokenRouteSegments(connection, cluster, marketUrl) {
  const marketCaches = await fetchMarketCache(
    marketUrl || MARKETS_URL[cluster]
  );
  const amms = await getAllAmms(connection, marketCaches);
  const tokenRouteSegments = getTokenRouteSegments(amms); //-<
  return tokenRouteSegments;
}

async function getTopTokens() {
  const topTokens = await (
    await fetch("https://cache.jup.ag/top-tokens")
  ).json();
  return new Set(topTokens.filter((_, idx) => idx < 60));
}

async function getIntermediateTokens() {
  const intermediateTokensSet = await getTopTokens();
  for (const swapProtocolToken of Constants.SWAP_PROTOCOL_TOKENS) {
    intermediateTokensSet.add(swapProtocolToken);
  }

  const saberDecimalAmms = getSaberWrappedDecimalsAmms();
  saberDecimalAmms.forEach((item) => {
    intermediateTokensSet.add(item.wrappedToken.addDecimals.mint.toBase58());
  });
  return Array.from(intermediateTokensSet);
}

async function loadMarketInfo(connection, cluster, marketUrl) {
  const tokenRouteSegments = await fetchTokenRouteSegments(
    connection,
    cluster,
    marketUrl
  );
  const intermediateTokens = await getIntermediateTokens();

  return [tokenRouteSegments, intermediateTokens];
}

function shouldSkipOutputMint(intermediateTokens, minSegmentSize, outputMint) {
  return Boolean(
    intermediateTokens &&
      minSegmentSize > Constants.MIN_SEGMENT_SIZE_FOR_INTERMEDIATE_MINTS &&
      !intermediateTokens.includes(outputMint)
  );
}

function computeInputRouteSegments({
  inputMint,
  outputMint,
  tokenRouteSegments,
  intermediateTokens,
  swapMode,
  onlyDirectRoutes,
  marketName,
}) {
  const inputRouteSegments = new Map();
  let inputSegment = tokenRouteSegments.get(inputMint); // contains all markets for the input mint against against all other tokens
  let outputSegment = tokenRouteSegments.get(outputMint); //contains all markets for the output mint against all other tokens

  // console.log(`size of inputSegment: ${inputSegment.size}`);
  // console.log(`size of outputSegment: ${outputSegment.size}`);

  inputSegment.forEach((v, k) => {
    const filteredMarkets = v.filter((market) => market.label === marketName);
    if (filteredMarkets.length === 1) {
      inputSegment.set(k, filteredMarkets);
    } else {
      inputSegment.delete(k);
    }
  });

  outputSegment.forEach((v, k) => {
    const filteredMarkets = v.filter((market) => market.label === marketName);
    if (filteredMarkets.length === 1) {
      outputSegment.set(k, filteredMarkets);
    } else {
      outputSegment.delete(k);
    }
  });

  // console.log(`size of inputSegment(After): ${inputSegment.size}`);
  // console.log(`size of outputSegment(After): ${outputSegment.size}`);

  // [...inputSegment].forEach(([k, v])=> {
  //   v.forEach((market) => {
  //     console.log(`input Segment Arb label: ${market.label}`)
  //   })
  // });

  // [...outputSegment].forEach(([k, v])=> {
  //   v.forEach((market) => {
  //     console.log(`output Segment Arb label: ${market.label}`)
  //   })
  // });

  if (inputSegment && outputSegment) {
    const minSegmentSize = Math.min(inputSegment.size, outputSegment.size); // this is used to minimize the looping part
    // if SOL => MER, SOL has 100 keys but MER has 6 keys so only the first 6 loops are required always

    const shouldStartWithInputSegment = inputSegment.size < outputSegment.size;
    const inputInnerMap = new Map();
    const outputInnerMap = new Map();
    let [startSegment, endSegment, startMint, endMint] =
      shouldStartWithInputSegment
        ? [inputSegment, outputSegment, inputMint, outputMint]
        : [outputSegment, inputSegment, outputMint, inputMint];

    for (let [mint, amms] of startSegment.entries()) {      
      if (mint === endMint) {
        inputInnerMap.set(mint, amms);
        outputInnerMap.set(startMint, amms);
        continue;
      }
      
      if (intermediateTokens && !intermediateTokens.includes(mint)) {
        continue;
      }

      const intersectionAmms = endSegment.get(mint);

      if (intersectionAmms) {
        inputRouteSegments.set(mint, new Map([[startMint, amms], [endMint, intersectionAmms]]));
        inputInnerMap.set(mint, amms);
        outputInnerMap.set(mint, intersectionAmms);
      }

    }

    inputRouteSegments.set(startMint, inputInnerMap);
    inputRouteSegments.set(endMint, outputInnerMap);

    // console.log(`inputRouteSegment for inputMint: ${JSON.stringify([...(inputRouteSegments.get(inputMint)).entries()])}`);
    // console.log(`inputRouteSegment for outputMint: ${JSON.stringify([...(inputRouteSegments.get(outputMint)).entries()])}`);
  }

  return inputRouteSegments;
}

async function fetchAccountInfos(connection, routes) {
  const accountInfosMap = new Map();
  const accountsToFetchSet = new Set();
  const ammMap = new Map();
  routes.forEach((innerMap) => {
    innerMap.forEach((amms) => {
      amms.forEach((amm) => {
        ammMap.set(amm.id, amm);
        amm.getAccountsForUpdate().forEach((account) => {
          // Only add accountInfos that is not in the Map
          accountsToFetchSet.add(account.toBase58());
        });
      });
    });
  });
  const accountsToFetch = Array.from(accountsToFetchSet);
  if (accountsToFetch.length > 0) {
    const accountInfos = await chunkedGetMultipleAccountInfos(
      connection,
      accountsToFetch
    );

    accountInfos.forEach((item, index) => {
      const publicKey = accountsToFetch[index];

      if (item) {
        accountInfosMap.set(publicKey, item);
      }
    });

    ammMap.forEach((amm) => {
      amm.update(accountInfosMap);
    });
  }
  // console.log(`Automated Market Maker Map: ${JSON.stringify([...ammMap.entries()])}`);
}





async function computeRoutes(
  connection,
  feeCalculator,
  inputMint,
  outputMint,
  amount,
  slippage,
  tokenRouteSegments,
  intermediateTokens,
  marketName,
  userKeypair,
  serumOpenOrdersPromise,
  swapMode
) {
  const inputMintString = inputMint.toBase58();
  const outputMintString = outputMint.toBase58(); // Platform fee can only be applied when fee account exists

  console.time("computeInputRouteSegments");
  const inputRouteSegment = computeInputRouteSegments({
    inputMint: inputMintString,
    outputMint: outputMintString,
    tokenRouteSegments: tokenRouteSegments,
    intermediateTokens: intermediateTokens,
    onlyDirectRoutes: true,
    swapMode: swapMode,
    marketName,
  });
  console.timeEnd("computeInputRouteSegments");

  console.time("fetchAccountInfos");
  await fetchAccountInfos(connection, inputRouteSegment);
  console.timeEnd("fetchAccountInfos");

  const platformFeeBps = 0;
  const filterTopNResult = 3;
  const onlyDirectRoutes = true;

  console.log(`Fetched Serum Oper Orders`);

  console.time("processInputRouteSegmentToRoutesInfos");

  const routesInfos = routeGenerator.processInputRouteSegmentToRoutesInfos(
    inputRouteSegment,
    inputMint,
    outputMint,
    amount,
    utils.getDepositAndFeesForUser,
    platformFeeBps,
    slippage,
    onlyDirectRoutes,
    swapMode,
    connection,
    feeCalculator,
    userKeypair,
    serumOpenOrdersPromise,
    filterTopNResult
  );
  console.timeEnd("processInputRouteSegmentToRoutesInfos");

  return routesInfos;
}

async function getRoutes(
  connection,
  feeCalculator,
  inputToken,
  outputToken,
  inputAmount,
  slippage,
  tokenRouteSegments,
  intermediateTokens,
  marketName,
  userKeypair,
  serumOpenOrdersPromise,
  swapMode
) {
  const inputAmountInSmallestUnits = inputToken
    ? Math.round(inputAmount * 10 ** inputToken.decimals)
    : 0;

  const routes = await computeRoutes(
    connection,
    feeCalculator,
    new web3.PublicKey(inputToken.address),
    new web3.PublicKey(outputToken.address),
    JSBI.BigInt(inputAmountInSmallestUnits), // raw input amount of tokens
    slippage,
    tokenRouteSegments,
    intermediateTokens,
    marketName,
    userKeypair,
    serumOpenOrdersPromise,
    swapMode
  );

  return routes;
}

module.exports = {
  fetchMarketCache,
  loadMarketInfo,
  getRoutes,
};

/* What i need from route info
  - swap mode
  - in amount
  - otherAmountThreshold
*/

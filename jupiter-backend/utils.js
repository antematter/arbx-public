const web3 = require("@solana/web3.js");
const splToken = require("@solana/spl-token");
const optimist = require("@mercurial-finance/optimist");
const serum = require("@project-serum/serum");
const fetch = require("cross-fetch");

const { JUPITER_PROGRAM } = require("./jupiter");
const Amms = require("./amms");
const SwapMode = Amms.SwapMode;
const constants = require("./constants");
const log = console.log;

const SERUM_OPEN_ACCOUNT_LAMPORTS = 23352760;
const OPEN_TOKEN_ACCOUNT_LAMPORTS = 2039280;

function getContext(network) {
  const networks = {
    localnet: "http://127.0.0.1:8899",
    devnet: "https://api.devnet.solana.com",
    mainnet:
      "https://silent-morning-river.solana-mainnet.quiknode.pro/b3c01c1492c745c169835076fe23a52ea8337b4b",
  };
  const connection = new web3.Connection(networks[network], {
    confirmTransactionInitialTimeout: 90000,
    commitment: "recent",
  });

  return connection;
}

class Owner {
  constructor(owner) {
    this._owner = void 0;
    this._owner = owner;
  }

  get publicKey() {
    if (Owner.isKeyPair(this._owner)) {
      return this._owner.publicKey;
    }

    return this._owner;
  }

  get signer() {
    return Owner.isKeyPair(this._owner) ? this._owner : undefined;
  }

  get isKeyPair() {
    return Owner.isKeyPair(this._owner);
  }

  get isPublicKey() {
    return Owner.isPublicKey(this._owner);
  }

  static isKeyPair(owner) {
    return owner.secretKey !== undefined;
  }

  static isPublicKey(owner) {
    return !Owner.isKeyPair(owner);
  }
}

const getEmptyInstruction = () => ({
  instructions: [],
  cleanupInstructions: [],
  signers: [],
});

var addDecimalsJson = [
  {
    wrapper: "2B5Qedoo95Pjpv9xVPw82bbmcGDGCNHroKpzQE2CNHRZ",
    underlying: "CASHVDm2wsJXfhj6VWxb7GiMdoLc17Du7paH4bNr5woT",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "3YCGgStAV9H7TdPYdBnRP8yoH4Zqdmyt7xo6KB4Wa8xt",
    mint: "C9xqJe3gMTUDKidZsZ6jJ7tL9zSLimDUKVpgUbLZnNbi",
    decimals: 9,
  },
  {
    wrapper: "2ffwMLE4dxSv59eYXhfhfuS81kz6gzf6DZjdBxRHZz9A",
    underlying: "AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "H5tnZcfHCzHueNnfd6foeBBUUW4g7qXKt6rKzT7wg6oP",
    mint: "FTT9rBBrYwcHam4qLvkzzzhrsihYMbZ3k6wJbdoahxAt",
    decimals: 9,
  },
  {
    wrapper: "3A85wiQg2REhBVxVS1CjDaS333TBNM2g37BbdNGSMheg",
    underlying: "CDJWUqTcYTVAKXAVXoQZFes5JUFc7owSeq7eMQcDSbo5",
    underlyingDecimals: 8,
    wrapperUnderlyingTokens: "764FaQrrREvNTpaH2yXyrPZgVBaXA7AXM8vyCaevXitD",
    mint: "BtX7AfzEJLnU8KQR1AgHrhGH5s2AHUTbfjhUQP8BhPvi",
    decimals: 10,
  },
  {
    wrapper: "7hWjnVC6FNkmmgjq88LEnRycrKvxVB1MsJ6FQcrvxe4n",
    underlying: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "B22gDMgN2tNWmvyzhb5tamJKanWcUUUw2zN3h3qjgQg8",
    mint: "9999j2A8sXUtHtDoQdk528oVzhaKBsXyRGZ67FKGoi7H",
    decimals: 9,
  },
  {
    wrapper: "8zooyPZrq2mth917VrHLtNTk6GvAhc2KgdB4DGBXYyke",
    underlying: "AUrMpCDYYcPuHhyNX8gEEqbmDPFUpBpHrNW3vPeCFn5Z",
    underlyingDecimals: 9,
    wrapperUnderlyingTokens: "7ZZyhVde6ZmnVMuFnrg3mRPHhvfBixLdEo7RnwxTtpF7",
    mint: "EY3s4nXTzHDiiysmjvj7zWP6yAX3n4xHmXkJWD1w1tGP",
    decimals: 15,
  },
  {
    wrapper: "93qsLbASEG8DmtSB2MEVaa25KvEm2afh5rzbaAJHLi5A",
    underlying: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    underlyingDecimals: 8,
    wrapperUnderlyingTokens: "4fUL9yLbFZEuG32SaCjWqJXwDTBFNnipteBWxMvvFoC8",
    mint: "KNVfdSJyq1pRQk9AKKv1g5uyGuk6wpm4WG16Bjuwdma",
    decimals: 9,
  },
  {
    wrapper: "ACvLVgR3UKdDB3b1QapsbJsPXaUrBPdJGDfiFnMYMXoz",
    underlying: "F6v4wfAdJB8D8p77bMXZgYt8TDKsYxLYxH5AFhUkYx9W",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "AvqMJWHsZscPWTAUcj8dZi2ch6XQEHMpiCMprfFovaU",
    mint: "LUNGEjUXyP48nrC1GYY5o4eTAkwm4RdX8BxFUxWJBLB",
    decimals: 9,
  },
  {
    wrapper: "AnKLLfpMcceM6YXtJ9nGxYekVXqfWy8WNsMZXoQTCVQk",
    underlying: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "77XHXCWYQ76E9Q3uCuz1geTaxsqJZf9RfX5ZY7yyLDYt",
    mint: "JEFFSQ3s8T3wKsvp4tnRAsUBW7Cqgnf8ukBZC4C8XBm1",
    decimals: 9,
  },
  {
    wrapper: "CGxMr5UrTjApBjU656N9NBAsGby4fWs1KgVtueQ8WKt6",
    underlying: "AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "7dVPR6jx3hKyNfuHPo3WtWdUpH4eh4Up4rfFhLHZqwy3",
    mint: "FTT8cGNp3rfTC6c44uPTuEFLqmsVDhjd2BhH65v2uppr",
    decimals: 8,
  },
  {
    wrapper: "D231Uoh24bXtUtWN51ZbFAFSBmGT3zuuEAHZNuCmtRjN",
    underlying: "CDJWUqTcYTVAKXAVXoQZFes5JUFc7owSeq7eMQcDSbo5",
    underlyingDecimals: 8,
    wrapperUnderlyingTokens: "C39Wq6X98TLcrnYCMkcHQhwUurkQMUdibUCpf2fVBDsm",
    mint: "FACTQhZBfRzC7A76antnpAoZtiwYmUfdAN8wz7e8rxC5",
    decimals: 9,
  },
  {
    wrapper: "EhQqUmkUXXnxmV7yA6PDrQWvLgSd9HkrwdDKk1B5m6Tc",
    underlying: "CbNYA9n3927uXUukee2Hf4tm3xxkffJPPZvGazc2EAH1",
    underlyingDecimals: 8,
    wrapperUnderlyingTokens: "8YC5eCS99umbK9K9LnHnTMMjnr7EWg1gam5maNB6uf9d",
    mint: "EU9aLffrTckFCs16da6CppHy63fAxMPF9ih1erQTuuRt",
    decimals: 9,
  },
  {
    wrapper: "EwWpia5t9Twiwdi8ghK8e8JHaf6ShNU9jmoYpvdZhBwC",
    underlying: "9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "9YB1zRL4ETuQFG8ZK1yD4GHBVDmH81EzwuSj75zdnKhK",
    mint: "UST8SCn7jrqsq51odVLqcmvnC658HkqrKrPL3w2hHQ7",
    decimals: 8,
  },
  {
    wrapper: "F9TsAsh5RirU3LqyTJECLQEGXnF4RQT7ckvexCP1KNTu",
    underlying: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "BSTjdztBrsptuxfz9JHS31Wc9CknpLeL1wqZjeVs1Ths",
    mint: "AEUT5uFm1D575FVCoQd5Yq891FJEqkncZUbBFoFcAhTV",
    decimals: 9,
  },
  {
    wrapper: "FCgoT8RpsopdM5QT6AB98NUfUnDnu7y865MFpRx93JrS",
    underlying: "EzfgjvkSwthhgHaceR3LnKXUoRkP6NUhfghdaHAj1tUv",
    underlyingDecimals: 8,
    wrapperUnderlyingTokens: "5yugfArBAUZJJBUCRWPuiLyi6CWp1f67H9xgg3hcgSkx",
    mint: "FTT9GrHBVHvDeUTgLU8FxVJouGqg9uiWGmmjETdm32Sx",
    decimals: 9,
  },
  {
    wrapper: "FDGtFWVhEb1zxnaW2FzogeGDxLoAV7Cu9XdNYPEVwqt",
    underlying: "8wv2KAykQstNAj2oW6AHANGBiFKVFhvMiyyzzjhkmGvE",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "4R6PmC8BJcPDBsEMGpXpLCnFFkUZhEgZy6pMNtc2LqA4",
    mint: "KUANeD8EQvwpT1W7QZDtDqctLEh2FfSTy5pThE9CogT",
    decimals: 9,
  },
  {
    wrapper: "FPuYMuodknZuQKHA8Wp4PBbp52Qu8nK2oAuwedp2WfM3",
    underlying: "9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "GxpyQZi5VkZDSq5TUycMau11sCkQkVCa8xYhBgiPMsyK",
    mint: "UST98bfV6EASdTFQrRwCBczpehdMFwYCUdLT5tEbhpW",
    decimals: 9,
  },
  {
    wrapper: "Ffxi5TSpFV9NeV5KyNDCC7fWnFoFd2bDcL1eViSAE2M2",
    underlying: "CASHVDm2wsJXfhj6VWxb7GiMdoLc17Du7paH4bNr5woT",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "5s2et753hMXV945U3p5uz6RQqMkZGCPEjKjNPdUcCLLF",
    mint: "CASHedBw9NfhsLBXq1WNVfueVznx255j8LLTScto3S6s",
    decimals: 8,
  },
  {
    wrapper: "G4gRGymKo7MGzGZup12JS39YVCvy8YMM6KY9AmcKi5iw",
    underlying: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "AQhP39mE4o6BYNwnwYqnz7ZobkPBSLpCg8WvEESq1viZ",
    mint: "88881Hu2jGMfCs9tMu5Rr7Ah7WBNBuXqde4nR5ZmKYYy",
    decimals: 8,
  },
  {
    wrapper: "GiLSv94Wwyd6suH57Fu6HjEKsMxhNGfEwKn9vT22me1p",
    underlying: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "3cjAWoyDcco8UVCN17keNUNHoyz37ctgDa7G6zkeb81Y",
    mint: "T8KdT8hDzNhbGx5sjpEUxepnbDB1TZoCa7vtC5JjsMw",
    decimals: 8,
  },
  {
    wrapper: "GpkFF2nPfjUcsavgDGscxaUEQ2hYJ563AXXtU8ohiZ7c",
    underlying: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "6hYDFhZ5ddfzoqaAbzRHm8mzG2MQzYQV9295sQHsvNBV",
    mint: "SBTCB6pWqeDo6zGi9WVRMLCsKsN6JiR1RMUqvLtgSRv",
    decimals: 8,
  },
  {
    wrapper: "fvSvtHNFuDHrAN82YEyBApRs3U6vUGCLzKGMuPmCaF8",
    underlying: "2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk",
    underlyingDecimals: 6,
    wrapperUnderlyingTokens: "4JWyJ4ZYsQ8uiYue2tTEqcHcFXrDuaQ1rsyjNFfrZm65",
    mint: "SL819j8K9FuFPL84UepVcFkEZqDUUvVzwDmJjCHySYj",
    decimals: 8,
  },
];

function createOpenOrdersInstruction(market, userTransferAuthority) {
  const [openOrders] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("open_orders"),
      market.publicKey.toBuffer(),
      userTransferAuthority.toBuffer(),
    ],
    constants.JUPITER_PROGRAM_ID
  );
  const ix = JUPITER_PROGRAM.instruction.createOpenOrders({
    accounts: {
      openOrders,
      payer: userTransferAuthority,
      dexProgram: market.programId,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
      market: market.publicKey,
    },
  });
  return [openOrders, ix];
}

async function getOrCreateOpenOrdersAddress(
  connection,
  user,
  serumMarket,
  marketToOpenOrdersAddress
) {
  const result = getEmptyInstruction();
  const marketAddress = serumMarket.address.toString();

  if (marketToOpenOrdersAddress) {
    // check existing map
    let openOrdersAddress = marketToOpenOrdersAddress.get(marketAddress);

    if (openOrdersAddress) {
      let openOrdersAccountInfo = null; // We verify if it indeed exists, with low commitment to pick it up, to address the unsafe behaviour below

      openOrdersAccountInfo = await connection.getAccountInfo(
        openOrdersAddress,
        "confirmed"
      );

      if (openOrdersAccountInfo) {
        return { ...result, address: openOrdersAddress };
      }
    }
  }

  const [newOpenOrdersAddress, ix] = createOpenOrdersInstruction(
    serumMarket,
    user
  );
  const newOpenOrdersAddressInfo = await connection.getAccountInfo(
    newOpenOrdersAddress
  );

  if (!newOpenOrdersAddressInfo) {
    result.instructions = [ix];
  } // This is unsafe, since we don't know yet if it has succeeded

  marketToOpenOrdersAddress === null || marketToOpenOrdersAddress === void 0
    ? void 0
    : marketToOpenOrdersAddress.set(
        serumMarket.address.toString(),
        newOpenOrdersAddress
      );
  return { ...result, address: newOpenOrdersAddress };
}

function createAssociatedTokenAccountInstruction(
  payer,
  associatedToken,
  owner,
  mint,
  programId = splToken.TOKEN_PROGRAM_ID,
  associatedTokenProgramId = splToken.ASSOCIATED_TOKEN_PROGRAM_ID
) {
  const keys = [
    {
      pubkey: payer,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedToken,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: owner,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: mint,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: programId,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new web3.TransactionInstruction({
    keys,
    programId: associatedTokenProgramId,
    data: Buffer.alloc(0),
  });
}

async function findOrCreateAssociatedAccountByMint({
  connection,
  payer,
  owner: { publicKey },
  mintAddress,
  unwrapSOL,
}) {
  const mint =
    typeof mintAddress === "string"
      ? new web3.PublicKey(mintAddress)
      : mintAddress;
  const toAccount = await splToken.Token.getAssociatedTokenAddress(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    mint,
    publicKey,
    true
  );
  const cleanupInstructions = [];
  const instructions = [];
  const info = await connection.getAccountInfo(toAccount);

  if (info === null) {
    instructions.push(
      createAssociatedTokenAccountInstruction(payer, toAccount, publicKey, mint)
    );
  } else {
    const tokenAccountInfo = optimist.deserializeAccount(info.data);

    if (tokenAccountInfo && !tokenAccountInfo.owner.equals(publicKey)) {
      // What to do at the top level in UIs and SDK?
      throw new Error(
        `/!\ ATA ${toAccount.toBase58()} is not owned by ${publicKey.toBase58()}`
      );
    }
  } // We close it when wrapped SOL

  if (mint.equals(constants.WRAPPED_SOL_MINT) && unwrapSOL) {
    cleanupInstructions.push(
      splToken.Token.createCloseAccountInstruction(
        splToken.TOKEN_PROGRAM_ID,
        toAccount,
        publicKey,
        publicKey,
        []
      )
    );
  }

  return {
    address: toAccount,
    instructions: instructions,
    cleanupInstructions,
    signers: [],
  };
}

async function routeAtaInstructions(connection, marketInfos, owner, unwrapSOL) {
  const getUserIntermediateTokenAccountAddress = async () => {
    const userIntermediateTokenAccountAddress =
      marketInfos.length === 2
        ? await findOrCreateAssociatedAccountByMint({
            connection,
            owner: owner,
            payer: owner.publicKey,
            mintAddress: marketInfos[0].outputMint,
            unwrapSOL,
          })
        : undefined;
    return userIntermediateTokenAccountAddress;
  };

  const getUserDestinationTokenAccountAddress = () => {
    return findOrCreateAssociatedAccountByMint({
      connection,
      owner: owner,
      payer: owner.publicKey,
      mintAddress:
        marketInfos.length === 2
          ? marketInfos[1].outputMint
          : marketInfos[0].outputMint,
      unwrapSOL,
    });
  };

  const [
    userIntermediaryTokenAccountResult,
    userDestinationTokenAccountResult,
  ] = await Promise.all([
    getUserIntermediateTokenAccountAddress(),
    getUserDestinationTokenAccountAddress(),
  ]);
  return {
    userIntermediaryTokenAccountResult,
    userDestinationTokenAccountResult,
  };
}

function sum(values) {
  return values.reduce((value, acc) => {
    acc += value;
    return acc;
  }, 0);
}

function calculateTransactionDepositAndFee({
  intermediate,
  destination,
  openOrders,
  hasWrapUnwrapSOL,
  feeCalculator,
}) {
  const openOrdersDeposits = openOrders
    .filter((ooi) => ooi && ooi.instructions.length > 0)
    .map(() => SERUM_OPEN_ACCOUNT_LAMPORTS);
  const ataDeposits = [intermediate, destination]
    .filter(
      (item) =>
        (item === null || item === void 0
          ? void 0
          : item.instructions.length) && item.cleanupInstructions.length === 0
    )
    .map(() => OPEN_TOKEN_ACCOUNT_LAMPORTS);
  const signatureFee =
    ([
      ...(openOrders === null || openOrders === void 0
        ? void 0
        : openOrders.map((oo) =>
            oo === null || oo === void 0 ? void 0 : oo.signers
          )),
      intermediate === null || intermediate === void 0
        ? void 0
        : intermediate.signers,
      destination.signers,
    ]
      .filter(Boolean)
      .flat().length +
      1) *
    feeCalculator.lamportsPerSignature;
  const totalFeeAndDeposits = sum([
    signatureFee,
    ...openOrdersDeposits,
    ...ataDeposits,
  ]); // We need to account for temporary wrapped SOL token accounts as intermediary or output

  const minimumSOLForTransaction = sum([
    signatureFee,
    ...openOrdersDeposits,
    ...[intermediate, destination]
      .filter((item) => {
        var _item$instructions$le;

        return (
          ((_item$instructions$le =
            item === null || item === void 0
              ? void 0
              : item.instructions.length) !== null &&
          _item$instructions$le !== void 0
            ? _item$instructions$le
            : 0) > 0
        );
      })
      .map(() => OPEN_TOKEN_ACCOUNT_LAMPORTS),
    hasWrapUnwrapSOL ? OPEN_TOKEN_ACCOUNT_LAMPORTS : 0,
  ]);
  return {
    signatureFee,
    openOrdersDeposits,
    ataDeposits,
    totalFeeAndDeposits,
    minimumSOLForTransaction,
  };
}

async function getDepositAndFeeFromInstructions({
  connection,
  owner,
  inputMint,
  marketInfos,
  feeCalculator,
  serumOpenOrdersPromise,
  wrapUnwrapSOL: unwrapSOL,
}) {
  const hasWrapUnwrapSOL =
    inputMint.equals(constants.WRAPPED_SOL_MINT) && unwrapSOL;
  const openOrdersInstructionsPromise = Promise.all(
    marketInfos.map(async (marketInfo) => {
      const amm = marketInfo.amm;

      if (amm instanceof Amms.SerumAmm) {
        if (!amm.market) return;
        return await getOrCreateOpenOrdersAddress(
          connection,
          owner.publicKey,
          amm.market,
          await serumOpenOrdersPromise
        );
      }

      return;
    })
  );
  const promise = routeAtaInstructions({
    connection,
    marketInfos,
    owner,
    unwrapSOL,
  }).then(
    ({
      userIntermediaryTokenAccountResult,
      userDestinationTokenAccountResult,
    }) => {
      return openOrdersInstructionsPromise.then((openOrdersInstructions) => ({
        intermediate: userIntermediaryTokenAccountResult,
        destination: userDestinationTokenAccountResult,
        openOrders: openOrdersInstructions,
      }));
    }
  );
  const instructionResult = await promise;
  return calculateTransactionDepositAndFee({
    ...instructionResult,
    hasWrapUnwrapSOL,
    feeCalculator,
  });
}

async function getDepositAndFees(
  connection,
  feeCalculator,
  marketInfos,
  userPublicKey,
  wrapUnwrapSOL,
  /**
   * We can use Jupiter.findSerumOpenOrdersForOwner for this, if we want to reuse existing user serum open orders.
   */
  serumOpenOrdersPromise = Promise.resolve(new Map())
) {
  return getDepositAndFeeFromInstructions({
    connection: connection,
    feeCalculator: feeCalculator,
    inputMint: marketInfos[0].inputMint,
    marketInfos,
    serumOpenOrdersPromise,
    owner: new Owner(userPublicKey),
    wrapUnwrapSOL: wrapUnwrapSOL,
  });
}

function getDepositAndFeesForUser(
  connection,
  feeCalculator,
  marketInfos,
  user,
  serumOpenOrdersPromise
) {
  if (user && serumOpenOrdersPromise) {
    const user = new Owner(user);
    return getDepositAndFees(
      connection,
      feeCalculator,
      marketInfos,
      user.publicKey,
      serumOpenOrdersPromise
    );
  }
  return Promise.resolve(undefined);
}

async function findSerumOpenOrdersForOwner(connection, cluster, userPublicKey) {
  const newMarketToOpenOrdersAddress = new Map();
  if (userPublicKey) {
    // const owner = new Owner(userPublicKey);
    const programId =
      cluster === "mainnet-beta"
        ? constants.MAINNET_SERUM_DEX_PROGRAM
        : constants.DEVNET_SERUM_DEX_PROGRAM;

    const allOpenOrders = await serum.OpenOrders.findForOwner(
      connection,
      userPublicKey.publicKey,
      programId
    );
    allOpenOrders.forEach((openOrders) => {
      newMarketToOpenOrdersAddress.set(
        openOrders.market.toString(),
        openOrders.address
      );
    });
  }

  return newMarketToOpenOrdersAddress;
}

function isPlatformFeeSupported(swapMode, amms) {
  if (swapMode === SwapMode.ExactOut) return false;

  if (amms.length > 1) {
    const [firstMarket, secondMarket] = amms;

    if (
      firstMarket instanceof Amms.RaydiumAmm &&
      secondMarket instanceof Amms.RaydiumAmm
    ) {
      return false;
    }
  }
  return true;
}

async function getPlatformFeeAccounts(connection, feeAccountOwner) {
  const tokenAccounts = (
    await connection.getTokenAccountsByOwner(feeAccountOwner, {
      programId: splToken.TOKEN_PROGRAM_ID,
    })
  ).value;
  const feeAccounts = tokenAccounts.reduce((acc, tokenAccount) => {
    const deserializedtokenAccount = optimist.deserializeAccount(
      tokenAccount.account.data
    );

    if (deserializedtokenAccount) {
      acc.set(deserializedtokenAccount.mint.toBase58(), tokenAccount.pubkey);
    }

    return acc;
  }, new Map());
  return feeAccounts;
}

async function getTokensInfo() {
  const raw_tokens = await (await fetch("https://cache.jup.ag/tokens")).json();
  const token_map = {};
  for (let token of raw_tokens) {
    if (token["chainId"] === 101) {
      token_map[token["symbol"]] = token;
    }
  }
  return token_map;
}

module.exports = {
  Owner,
  getContext,
  getEmptyInstruction,
  addDecimalsJson,
  getOrCreateOpenOrdersAddress,
  getDepositAndFeesForUser,
  findSerumOpenOrdersForOwner,
  routeAtaInstructions,
  isPlatformFeeSupported,
  createAssociatedTokenAccountInstruction,
  getPlatformFeeAccounts,
  getTokensInfo,
};

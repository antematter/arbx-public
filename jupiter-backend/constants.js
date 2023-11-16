const web3 = require("@solana/web3.js");

const WRAPPED_SOL_MINT = new web3.PublicKey(
  "So11111111111111111111111111111111111111112"
);
const MAINNET_SERUM_DEX_PROGRAM = new web3.PublicKey(
  "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
);
const DEVNET_SERUM_DEX_PROGRAM = new web3.PublicKey(
  "DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY"
);

const STEP_TOKEN_SWAP_PROGRAM_ID = new web3.PublicKey(
  "SSwpMgqNDsyV7mAgN9ady4bDVu5ySjmmXejXvy2vLt1"
);
const CROPPER_STATE_ADDRESS = new web3.PublicKey(
  "3hsU1VgsBgBgz5jWiqdw9RfGU6TpWdCmdah1oi4kF3Tq"
);
const WHIRLPOOL_PROGRAM_ID = new web3.PublicKey(
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
);
const CYKURA_FACTORY_STATE_ADDRESS = new web3.PublicKey(
  "DBsMwKfeoUHhxMi9x6wd2AsT12UwUCssjNbUzu1aKgqj"
);
const MARINADE_PROGRAM_ID = new web3.PublicKey(
  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD"
);
const JUPITER_PROGRAM_ID = new web3.PublicKey(
  "JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph"
);
const RAYDIUM_AMM_V4_PROGRAM_ID = new web3.PublicKey(
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
);
const CYKURA_PROGRAM_ID = new web3.PublicKey(
  "cysPXAjehMpVKUapzbMCCnpFxUFFryEWEaLgnb9NrR8"
);
const ALDRIN_SWAP_V2_PROGRAM_ID = new web3.PublicKey(
  "CURVGoZn8zycx6FXwwevgBTB2gVvdbGTEpvMJDbgs2t4"
);

const STABLE_MARKET_ADDRESSES = [
  "77quYg4MGneUdjgXCunt9GgM1usmrxKY31twEy3WHwcS",
  "5cLrMai1DsLRYc1Nio9qMTicsWtvzjzZfJPXyAoF4t1Z",
  "EERNEEnBqdGzBS8dd46wwNY5F2kwnaCQ3vsq2fNKGogZ",
  "8sFf9TW3KzxLiBXcDcjAxqabEsRroo4EiRr3UG1xbJ9m",
  "2iDSTGhjJEiRxNaLF27CY6daMYPs5hgYrP2REHd5YD62", // stSOL/SOL
];

const CREMA_PROGRAM_ID = new web3.PublicKey(
  "6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319"
);

const ALDRIN_SWAP_PROGRAM_ID = new web3.PublicKey(
  "AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6"
);
const CROPPER_PROGRAM_ID = new web3.PublicKey(
  "CTMAxxk34HjKWxQ3QLZK1HpaLXmBveao3ESePXbiyfzh"
);
const SENCHA_PROGRAM_ID = new web3.PublicKey(
  "SCHAtsf8mbjyjiv4LkhLKutTf6JnZAbdJKFkXQNMFHZ"
);
const LIFINITY_PROGRAM_ID = new web3.PublicKey(
  "EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S"
);

const JUPITER_WALLET =new web3.PublicKey('BUX7s2ef2htTGb2KKoPHWkmzxPj4nTWMWRgs5CSbQxf9');

const MARKETS_URL = {
  devnet: "https://api.jup.ag/api/markets/cache/devnet",
  "mainnet-beta": "https://cache.jup.ag/markets?v=3",
  testnet: "https://api.jup.ag/api/markets/cache/devnet",
};

const PROGRAM_ID_TO_LABEL = new Map([
  ["9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP", "Orca"],
  [STEP_TOKEN_SWAP_PROGRAM_ID.toBase58(), "Step"],
  ["PSwapMdSai8tjrEXcxFeQth87xC4rRsa4VA5mhGhXkP", "Penguin"],
  ["SSwapUtytfBdBn1b9NUGG6foMVPtcWgpRU32HToDUZr", "Saros"],
  ["Dooar9JkhdZ7J3LHN3A7YCuoGRUggXhQaG4kijfLGU2j", "Stepn"],
]);
const SWAP_PROTOCOL_TOKENS = [
  "StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT",
  "DubwWZNWiNGMMeeQHPnMATNj77YZPZSAz2WVR5WjLJqz", // CRP
];

const MERCURIAL_SWAP_PROGRAM_ID = new web3.PublicKey(
  "MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky"
);
const MIN_SEGMENT_SIZE_FOR_INTERMEDIATE_MINTS = 100;

const PRODUCTION_TOKEN_LEDGERS = [
  new web3.PublicKey("755CiAfB63jK8DTZSM38ZRBTjf1inGM4QfLJTfpPM9x3"),
  new web3.PublicKey("5ZZ7w2C1c348nQm4zaYgrgb8gfyyqQNzH61zPwGvEQK9"),
  new web3.PublicKey("H4K65yLyYqVsDxgNCVGqK7MqrpKFLZjmqf95ZvmfyVDx"),
  new web3.PublicKey("HE4STzYv5dzw2G374ynt4EYvzuKLG41P2xnNffzpdWnG"),
  new web3.PublicKey("3HmXTbZf6G2oEjN3bPreZmF7YGLbbEXFkgAbVFPaimwU"),
  new web3.PublicKey("CUNMrNvGNh1aWR6cVzAQekdsW2dfacnQicyfvgvrN5ap"),
  new web3.PublicKey("6Q6vMHsUFA7kuwdkG9vm7gByMfk151Z9eMSwE14fHcrG"),
];

const TOKEN_LEDGER =
  PRODUCTION_TOKEN_LEDGERS[
    Math.floor(Math.random() * PRODUCTION_TOKEN_LEDGERS.length)
  ];

module.exports = {
  WRAPPED_SOL_MINT,
  MAINNET_SERUM_DEX_PROGRAM,
  DEVNET_SERUM_DEX_PROGRAM,
  STEP_TOKEN_SWAP_PROGRAM_ID,
  CROPPER_STATE_ADDRESS,
  WHIRLPOOL_PROGRAM_ID,
  CYKURA_FACTORY_STATE_ADDRESS,
  MARINADE_PROGRAM_ID,
  JUPITER_PROGRAM_ID,
  RAYDIUM_AMM_V4_PROGRAM_ID,
  CYKURA_PROGRAM_ID,
  ALDRIN_SWAP_V2_PROGRAM_ID,
  STABLE_MARKET_ADDRESSES,
  CREMA_PROGRAM_ID,
  MARKETS_URL,
  ALDRIN_SWAP_PROGRAM_ID,
  CROPPER_PROGRAM_ID,
  SENCHA_PROGRAM_ID,
  PROGRAM_ID_TO_LABEL,
  LIFINITY_PROGRAM_ID,
  SWAP_PROTOCOL_TOKENS,
  MERCURIAL_SWAP_PROGRAM_ID,
  MIN_SEGMENT_SIZE_FOR_INTERMEDIATE_MINTS,
  TOKEN_LEDGER,
  JUPITER_WALLET
};

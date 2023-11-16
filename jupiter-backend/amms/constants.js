const web3 = require("@solana/web3.js");

exports.STEP_TOKEN_SWAP_PROGRAM_ID = new web3.PublicKey(
  "SSwpMgqNDsyV7mAgN9ady4bDVu5ySjmmXejXvy2vLt1"
);
exports.CROPPER_STATE_ADDRESS = new web3.PublicKey(
  "3hsU1VgsBgBgz5jWiqdw9RfGU6TpWdCmdah1oi4kF3Tq"
);
exports.WHIRLPOOL_PROGRAM_ID = new web3.PublicKey(
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
);
exports.CYKURA_FACTORY_STATE_ADDRESS = new web3.PublicKey(
  "DBsMwKfeoUHhxMi9x6wd2AsT12UwUCssjNbUzu1aKgqj"
);
exports.MARINADE_PROGRAM_ID = new web3.PublicKey(
  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD"
);
exports.JUPITER_PROGRAM_ID = new web3.PublicKey(
  "JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph"
);
exports.RAYDIUM_AMM_V4_PROGRAM_ID = new web3.PublicKey(
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
);
exports.CYKURA_PROGRAM_ID = new web3.PublicKey(
  "cysPXAjehMpVKUapzbMCCnpFxUFFryEWEaLgnb9NrR8"
);
exports.ALDRIN_SWAP_V2_PROGRAM_ID = new web3.PublicKey(
  "CURVGoZn8zycx6FXwwevgBTB2gVvdbGTEpvMJDbgs2t4"
);

exports.STABLE_MARKET_ADDRESSES = [
  "77quYg4MGneUdjgXCunt9GgM1usmrxKY31twEy3WHwcS",
  "5cLrMai1DsLRYc1Nio9qMTicsWtvzjzZfJPXyAoF4t1Z",
  "EERNEEnBqdGzBS8dd46wwNY5F2kwnaCQ3vsq2fNKGogZ",
  "8sFf9TW3KzxLiBXcDcjAxqabEsRroo4EiRr3UG1xbJ9m",
  "2iDSTGhjJEiRxNaLF27CY6daMYPs5hgYrP2REHd5YD62", // stSOL/SOL
]; 

exports.ALDRIN_SWAP_PROGRAM_ID = new web3.PublicKey('AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6'); 
exports.SABER_ADD_DECIMALS_PROGRAM_ID = new web3.PublicKey('DecZY86MU5Gj7kppfUCEmd4LbXXuyZH1yHaP2NTqdiZB');

exports.TAKER_FEE_PCT = 0.0004;
exports.STABLE_TAKER_FEE_PCT = 0.0001; // Stable markets are hardcoded in the program


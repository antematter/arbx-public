const anchor = require("@project-serum/anchor");
const web3 = require("@solana/web3.js");

const { IDL } = require("./idl");

const JUPITER_PROGRAM_ID = new web3.PublicKey(
  "JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph"
);

exports.JUPITER_PROGRAM = new anchor.Program(IDL, JUPITER_PROGRAM_ID, {});
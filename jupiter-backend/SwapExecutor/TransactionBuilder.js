const web3 = require("@solana/web3.js");

class TransactionBuilder {
  constructor(connection, feePayer, owner) {
    this.connection = connection;
    this.feePayer = feePayer;
    this.instructions = [];
    this.owner = owner;
  }

  addInstruction(instruction) {
    this.instructions.push(instruction);
    return this;
  }

  async build(recentBlockHash) {
    if (!recentBlockHash) {
      recentBlockHash = (await this.connection.getLatestBlockhash("confirmed"))
        .blockhash;
    }

    const txFields = {
      recentBlockhash: recentBlockHash,
      feePayer: this.feePayer,
    };
    let instructions = [];
    let cleanupInstructions = [];
    let signers = [];

    this.instructions.forEach((curr) => {
      instructions = instructions.concat(curr.instructions);
      cleanupInstructions = cleanupInstructions.concat(
        curr.cleanupInstructions
      );
      signers = signers.concat(curr.signers);
    });
    const transaction = new web3.Transaction(txFields);
    instructions
      .concat(cleanupInstructions)
      .forEach((ix) => transaction.add(ix));
    transaction.feePayer = this.feePayer;
    return {
      transaction: transaction,
      signers: signers,
      execute: this.owner.isKeyPair
        ? () => {
            return this.connection.sendTransaction(transaction, signers);
          }
        : async () => {
            throw new Error(
              "Please use a Keypair for the owner parameter to enable the execute function"
            );
          },
    };
  }
}

module.exports = {
  TransactionBuilder,
};

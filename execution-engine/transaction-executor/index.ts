import { Connection, Signer, Transaction, VersionedTransaction } from "@solana/web3.js";
import { MAX_TRANSACTION_RETRY_ATTEMPTS, ENABLE_TRADING } from "../constants";
import logger, { saveTxSignature } from "../logger";

export class TransactionExecutor {
  private connection: Connection;
  private userPubKey?: string;

  constructor(connection: Connection, pubkey?: string) {
    this.connection = connection;
    this.userPubKey = pubkey;
  }

  async sendLegacyTransaction(tx: Transaction, signers: Signer[]) {
    const blockhash = (await this.connection.getLatestBlockhash("confirmed")).blockhash;
    tx.recentBlockhash = blockhash;
    tx.sign(...signers);
    const rawTx = tx.serialize();

    let retryAttempts = 0;
    while (++retryAttempts <= MAX_TRANSACTION_RETRY_ATTEMPTS && ENABLE_TRADING) {
      const txid = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: true,
        preflightCommitment: "confirmed",
        maxRetries: 5,
      });
      logger.info(`Transaction signature is: ${txid}`);

      await new Promise((resolve) => setTimeout(resolve, 1000 * 6));

      const ret = await this.connection.getSignatureStatus(txid, { searchTransactionHistory: true });
      if (ret) {
        if (ret.value && ret.value.err === null) {
          await saveTxSignature(this.userPubKey!, txid);
          break;
        }
      }
    }
  }

  async sendVersionedTransaction(tx: VersionedTransaction, signers: Signer[]) {
    tx.sign(signers);

    let retryAttempts = 0;

    const serialized = tx.serialize();

    while (++retryAttempts <= MAX_TRANSACTION_RETRY_ATTEMPTS && ENABLE_TRADING) {
      const txid = await this.connection.sendRawTransaction(serialized, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 5,
      });

      logger.info(`Transaction signature is: ${txid}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * 6));
      const ret = await this.connection.getSignatureStatus(txid, { searchTransactionHistory: true });
      if (ret) {
        if (ret.value && ret.value.err === null) {
          await saveTxSignature(this.userPubKey!, txid);
          break;
        }
      }
    }
  }
}

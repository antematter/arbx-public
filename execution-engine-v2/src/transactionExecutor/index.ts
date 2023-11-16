import logger from "../logger";
import { SolanaRPCException } from "./types";
import { Connection, Keypair } from "@solana/web3.js";
import { ENABLE_TRADING, MAX_TRANSACTION_RETRY_ATTEMPTS } from "../constants";
import { LegacyTransactionWithHooks, VersionedTransactionWithHooks } from "../types";

export class TransactionExecutor {
    connection: Connection;
    payer: Keypair;

    constructor(connection: Connection, payer: Keypair) {
        this.connection = connection;
        this.payer = payer;
    }

    async sendLegacyTransaction(tx: LegacyTransactionWithHooks, txMessage: string) {
        if (tx.preTxHook) {
            await tx.preTxHook!(this.connection)!;
        }

        const blockhash = (await this.connection.getLatestBlockhash("confirmed")).blockhash;
        const signers = [...tx.signers, this.payer];
        tx.tx.recentBlockhash = blockhash;
        tx.tx.sign(...signers);
        const rawTx = tx.tx.serialize();

        let retryAttempts = 0;
        while (++retryAttempts <= MAX_TRANSACTION_RETRY_ATTEMPTS && ENABLE_TRADING) {
            const txid = await this.connection.sendRawTransaction(rawTx, {
                skipPreflight: true,
                preflightCommitment: "confirmed",
                maxRetries: 5,
            });
            const ret = await this.connection.getSignatureStatus(txid, { searchTransactionHistory: true });
            if (ret && ret.value && ret.value.err === null) {
                logger.info(`[${txMessage}]: https://solscan.io/tx/${txid}`);
                if (tx.postTxHook) {
                    await tx.postTxHook!(this.connection, txid)!;
                }
                break;
            }
            if (retryAttempts === MAX_TRANSACTION_RETRY_ATTEMPTS) {
                logger.error(`Failed to send legacy transaction in ${MAX_TRANSACTION_RETRY_ATTEMPTS} attempts!`);
            }
        }
    }

    async sendVersionedTransaction(tx: VersionedTransactionWithHooks, txMessage: string) {
        if (tx.preTxHook) {
            await tx.preTxHook(this.connection);
        }
        const latestBlockhash = await this.connection.getLatestBlockhash("confirmed");
        const signers = [...tx.signers, this.payer];
        tx.tx.sign(signers);

        let retryAttempts = 0;
        while (++retryAttempts <= MAX_TRANSACTION_RETRY_ATTEMPTS && ENABLE_TRADING) {
            let errorLogs: string[] = [];
            try {
                const txid = await this.connection.sendTransaction(tx.tx, {
                    skipPreflight: true,
                    preflightCommitment: "confirmed",
                    maxRetries: 5,
                });
                const confirmation = await this.connection.confirmTransaction({
                    signature: txid,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                });
                if (!confirmation.value.err) {
                    logger.info(`[${txMessage}]: https://solscan.io/tx/${txid}`);
                    if (tx.postTxHook) {
                        await tx.postTxHook(this.connection, txid)!;
                    }
                    break;
                }
            } catch (err) {
                const solanaException = err as SolanaRPCException;
                errorLogs = solanaException.logs ?? [solanaException.message];
            }
            if (retryAttempts === MAX_TRANSACTION_RETRY_ATTEMPTS) {
                logger.error(`Failed to send versioned transaction in ${MAX_TRANSACTION_RETRY_ATTEMPTS} attempts!`);
                for (const errorLine of errorLogs) {
                    logger.error(errorLine);
                }
            }
        }
    }
}

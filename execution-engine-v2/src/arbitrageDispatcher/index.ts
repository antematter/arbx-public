import { Connection, Keypair } from "@solana/web3.js";
import { ArbitrageCommandBuilder } from "../arbitrageCommandBuilder";
import { ArbitrageInstructionBuilder } from "../arbitrageInstructionBuilder";
import { Datastore } from "../datastore";
import { IArbitrageFilter } from "../filters/interface";
import {
    AddressLookupTableHandler,
    AssociateTokenAccountsHandler,
    IArbExecutionContext,
    ILutContext,
    OpenOrdersHandler,
} from "../handlers";
import logger, { arbLogger } from "../logger";
import { TransactionExecutor } from "../transactionExecutor";
import { TransactionMessages } from "../transactionExecutor/types";
import { ArbitrageFeed, LegacyTransactionWithHooks, TxInstruction, VersionedTransactionWithHooks } from "../types";
import { buildLegacyTransaction, buildVersionedTransaction } from "../utils";
import { ArbitrageContextStatus } from "./types";

export interface IFilter {
    filter: IArbitrageFilter;
    name: string;
}

export class ArbitrageDispatcher {
    connection: Connection;
    payer: Keypair;
    datastore: Datastore;

    filters: IFilter[];

    ataHandler: AssociateTokenAccountsHandler;
    lutHandler: AddressLookupTableHandler;
    openOrderHandler: OpenOrdersHandler;

    arbCommandBuilder: ArbitrageCommandBuilder;
    arbitrageIxBuilder: ArbitrageInstructionBuilder;
    txExecutor: TransactionExecutor;

    constructor(connection: Connection, payer: Keypair, datastore: Datastore) {
        this.connection = connection;
        this.payer = payer;
        this.datastore = datastore;

        this.filters = [];
        this.arbCommandBuilder = new ArbitrageCommandBuilder();
        this.arbitrageIxBuilder = new ArbitrageInstructionBuilder(this.connection, this.payer);

        this.ataHandler = new AssociateTokenAccountsHandler();
        this.lutHandler = new AddressLookupTableHandler();
        this.openOrderHandler = new OpenOrdersHandler();

        this.txExecutor = new TransactionExecutor(this.connection, this.payer);
    }

    registerFilter(filter: IFilter) {
        this.filters.push(filter);
    }

    async initialize(): Promise<void> {
        await this.arbitrageIxBuilder.load();
    }

    async submitArbitrage(arbitrage: ArbitrageFeed) {
        //apply filters
        let shouldArbBeExecuted: boolean = true;
        for (let filter of this.filters) {
            if (!filter.filter.filter(arbitrage)) {
                if (process.env.LOGGING_LEVEL === "VERBOSE") {
                    // logger.info(`${filter.name}: Failed for arb : ${JSON.stringify(arbitrage)}`);
                }
                shouldArbBeExecuted = false;
                return;
            }
        }
        if (shouldArbBeExecuted) {
            await this.executeArbitrage(arbitrage);
        }
        //if all checks pass, send it to executeARbitrage
    }

    async executeArbitrage(arbitrage: ArbitrageFeed) {
        const arbitrageCtx = await this.buildArbContext(arbitrage);
        if (arbitrageCtx[0] === ArbitrageContextStatus.Ok) {
            const ctx = arbitrageCtx[1] as IArbExecutionContext;
            const arbCommand = await this.arbCommandBuilder.buildArbitrage(ctx);

            if (arbCommand.trueProfitPotential < 1) {
                return;
            } else {
                arbLogger.info(`Executing Arbitrage: ${JSON.stringify(arbitrage)}`);
            }
            const arbInstruction = await this.arbitrageIxBuilder.buildArbitrageInstruction(arbCommand);

            const tx = await buildVersionedTransaction(
                this.connection,
                arbInstruction.instructions,
                arbInstruction.signers,
                arbCommand.luts,
                this.payer.publicKey,
            );
            await this.txExecutor.sendVersionedTransaction(tx, TransactionMessages.ArbitrageSubmission);
        } else {
            const message =
                arbitrageCtx[0] === ArbitrageContextStatus.CreateAta
                    ? TransactionMessages.AssociatedTokenAccountCreation
                    : arbitrageCtx[0] === ArbitrageContextStatus.CreateLut
                    ? TransactionMessages.AddressLookupTableCreation
                    : TransactionMessages.OpenOrderCreation;

            const tx = arbitrageCtx[1] as LegacyTransactionWithHooks;
            await this.txExecutor.sendLegacyTransaction(tx, message);
        }
    }

    async buildArbContext(
        arbitrage: ArbitrageFeed,
    ): Promise<[ArbitrageContextStatus, IArbExecutionContext | LegacyTransactionWithHooks]> {
        const ataResult = await this.ataHandler.handle({
            arbitrage: arbitrage,
            dataStore: this.datastore,
            connection: this.connection,
            payer: this.payer,
        });
        if (ataResult.status === "NOT_OK") {
            const instrs = ataResult.action as TxInstruction[];
            return [ArbitrageContextStatus.CreateAta, buildLegacyTransaction(instrs, undefined, ataResult.postTxHook)];
        }
        const lutResult = await this.lutHandler.handle(ataResult.action as ILutContext);
        if (lutResult.status === "NOT_OK") {
            const instrs = lutResult.action as TxInstruction[];
            return [ArbitrageContextStatus.CreateLut, buildLegacyTransaction(instrs, undefined, lutResult.postTxHook)];
        }
        const ooResult = await this.openOrderHandler.handle(lutResult.action as IArbExecutionContext);
        if (ooResult.status === "NOT_OK") {
            const instrs = ooResult.action as TxInstruction[];
            return [
                ArbitrageContextStatus.CreateOpenOrder,
                buildLegacyTransaction(instrs, undefined, ooResult.postTxHook),
            ];
        }
        return [ArbitrageContextStatus.Ok, ooResult.action as IArbExecutionContext];
    }
}

import { Connection, Keypair } from "@solana/web3.js";
import {
    ArbitrageCommand,
    OrcaSwapCommand,
    RaydiumSwapCommand,
    SerumSwapCommand,
} from "../arbitrageCommandBuilder/types";
import { AutomateMarketMakers, TxInstruction } from "../types";
import { OrcaSwapInstructionBuilder } from "./orcaSwapInstruction";
import { RaydiumSwapInstructionBuilder } from "./raydiumSwapInstruction";
import { SerumSwapInstructionBuilder } from "./serumSwapInstruction";
import { ArbitrageInstruction } from "./types";

export class ArbitrageInstructionBuilder {
    private connection: Connection;
    private payer: Keypair;
    private serumSwapInstructionBuilder: SerumSwapInstructionBuilder;
    private raydiumSwapInstructionBuilder: RaydiumSwapInstructionBuilder;
    private orcaSwapInstructionBuilder: OrcaSwapInstructionBuilder;

    constructor(connection: Connection, payer: Keypair) {
        this.connection = connection;
        this.payer = payer;
        this.serumSwapInstructionBuilder = new SerumSwapInstructionBuilder(this.connection, this.payer);
        this.raydiumSwapInstructionBuilder = new RaydiumSwapInstructionBuilder(this.payer);
        this.orcaSwapInstructionBuilder = new OrcaSwapInstructionBuilder(this.payer);
    }

    async load(): Promise<void> {
        await this.serumSwapInstructionBuilder.load();
        await this.raydiumSwapInstructionBuilder.load();
        await this.orcaSwapInstructionBuilder.load();
    }

    async buildArbitrageInstruction(arbCommand: ArbitrageCommand): Promise<ArbitrageInstruction> {
        const swapInstructions: Array<TxInstruction> = [];
        if (arbCommand.wrapSol) {
            swapInstructions.push(...arbCommand.wrapSol!);
        }

        for (let leg of arbCommand.swapLegs) {
            if (leg.amm === AutomateMarketMakers.SRM) {
                const swapLeg = leg as SerumSwapCommand;
                swapInstructions.push(await this.serumSwapInstructionBuilder.buildSwapInstruction(swapLeg));
            } else if (leg.amm === AutomateMarketMakers.RAY) {
                const swapLeg = leg as RaydiumSwapCommand;
                swapInstructions.push(await this.raydiumSwapInstructionBuilder.buildSwapInstruction(swapLeg));
            } else if (leg.amm === AutomateMarketMakers.ORCA) {
                const swapLeg = leg as OrcaSwapCommand;
                swapInstructions.push(await this.orcaSwapInstructionBuilder.buildSwapInstruction(swapLeg));
            }
        }
        if (arbCommand.unwrapSol) {
            swapInstructions.push(arbCommand.unwrapSol!);
        }
        return {
            instructions: swapInstructions.map((ix) => ix.instruction),
            signers: swapInstructions.map((ix) => ix.signers).flat(),
        };
    }
}

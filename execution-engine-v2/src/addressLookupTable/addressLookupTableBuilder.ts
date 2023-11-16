import { AddressLookupTableProgram, Connection, PublicKey } from "@solana/web3.js";
import { TxInstruction } from "../types";

export class AddressLookupTableBuilder {
    connection: Connection;
    payer: PublicKey;

    constructor(connection: Connection, payer: PublicKey) {
        this.connection = connection;
        this.payer = payer;
    }

    async createLookupTableInstruction(): Promise<[PublicKey, TxInstruction]> {
        let slot = await this.connection.getSlot("confirmed");
        while (!slot) {
            slot = await this.connection.getSlot("confirmed");
        }
        const [createLutInstr, lutAddress] = AddressLookupTableProgram.createLookupTable({
            authority: this.payer,
            payer: this.payer,
            recentSlot: slot,
        });
        return [
            lutAddress,
            {
                instruction: createLutInstr,
                signers: [],
            },
        ];
    }
    extendLookupTableInstruction(lutAddress: PublicKey, addresses: Array<PublicKey>): TxInstruction {
        const extendLutInstruction = AddressLookupTableProgram.extendLookupTable({
            payer: this.payer,
            authority: this.payer,
            lookupTable: lutAddress,
            addresses: addresses,
        });
        return {
            instruction: extendLutInstruction,
            signers: [],
        };
    }
    async fetchLookupTable(lutAddress: PublicKey) {
        const lookupTableAccount = (await this.connection.getAddressLookupTable(lutAddress)).value!;
        return lookupTableAccount;
    }
}

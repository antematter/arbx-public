export interface TransactionType {
    OpenOrderCreation: string;
    AddressLookupTableCreation: string;
    AssociatedTokenAccountCreation: string;
    ArbitrageSubmission: string;
}

export const TransactionMessages: TransactionType = {
    OpenOrderCreation: "CreateOpenOrderTransaction",
    AddressLookupTableCreation: "CreateAddressLookupTableTransaction",
    AssociatedTokenAccountCreation: "CreateAssociateTokenAccountTransaction",
    ArbitrageSubmission: "SubmitArbitrageTransaction",
};

export type SolanaRPCException = {
    logs: string[];
    message: string;
    stack: string;
};

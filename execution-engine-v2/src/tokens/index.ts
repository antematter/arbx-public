import { PublicKey } from "@solana/web3.js";

export class TokenData {
    public mint: PublicKey;
    public decimals: number;
    public symbol: string;

    constructor(symbol: string, mint: PublicKey, decimals: number) {
        this.symbol = symbol;
        this.mint = mint;
        this.decimals = decimals;
    }
}

export class AssosiatedTokenAccount {
    public symbol: string;
    public tokenMint: PublicKey;
    public ataAddress: PublicKey;

    constructor(symbol: string, tokenMint: PublicKey, ataAddress: PublicKey) {
        this.symbol = symbol;
        this.tokenMint = tokenMint;
        this.ataAddress = ataAddress;
    }
}

export { TokenDataLoader } from "./tokenLoader";

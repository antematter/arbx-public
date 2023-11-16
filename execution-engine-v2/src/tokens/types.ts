import { AssosiatedTokenAccount, TokenData } from ".";

export interface ITokenDataLoader {
    load(supportedTokens: Set<string>): Promise<Map<string, TokenData>>;
}

export interface IAssosiatedTokenAccountDataLoader {
    load(supportedTokens: Map<string, TokenData>): Promise<Map<string, AssosiatedTokenAccount>>;
}

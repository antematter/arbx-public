import { PublicKey } from "@solana/web3.js";
import { IAmmMarket, MarketStatus } from "./types";
import { TokenData } from "../tokens";

const UNDEFINED_TOKEN = new TokenData("undefined", PublicKey.default, 0);

export function makeMarketSymbolFromMints(
    baseMint: string,
    quoteMint: string,
    tokensInfo: Map<string, TokenData>,
): [MarketStatus, IAmmMarket] {
    const baseToken = [...tokensInfo.entries()].filter(([_, v]) => v.mint.toString() === baseMint);
    const quoteToken = [...tokensInfo.entries()].filter(([_, v]) => v.mint.toString() === quoteMint);

    if (baseToken.length === 0) {
        return [
            "BaseTokenNotFound",
            {
                baseToken: UNDEFINED_TOKEN,
                quoteToken: UNDEFINED_TOKEN,
                symbol: "",
            },
        ];
    } else if (quoteToken.length === 0) {
        return [
            "QuoteTokenNotFound",
            {
                baseToken: UNDEFINED_TOKEN,
                quoteToken: UNDEFINED_TOKEN,
                symbol: "",
            },
        ];
    }

    return [
        "OK",
        {
            baseToken: baseToken[0][1],
            quoteToken: quoteToken[0][1],
            symbol: `${baseToken[0][1].symbol}-${quoteToken[0][1].symbol}`,
        },
    ];
}

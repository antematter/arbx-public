import {
    OrcaAmm,
    OrcaDataLoader,
    OrcaFactory,
    RaydiumAmm,
    RaydiumDataLoader,
    RaydiumFactory,
    SerumAmm,
    SerumDataLoader,
    SerumFactory,
} from "../amms";
import { AutomateMarketMakers } from "../types";
import { AddressLookupTableStore } from "../addressLookupTable";
import { AssosiatedTokenAccountLoader } from "../tokens/ataLoader";
import { LutExtensionInstruction } from "../addressLookupTable/types";
import { AssosiatedTokenAccount, TokenData, TokenDataLoader } from "../tokens";
import { AddressLookupTableAccount, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { stringify } from "querystring";
/**
 * Fields
 *  payer: Transaction payer and owner of all accounts
 *  supportedTokens: Tokens supported by our platform
 *  AssosiatedTokenAccounts: Ata of all supported tokens. ATA would be created JIT
 *
 *
 *
 * Description:
 *  - supportedTokens: <tokenSymbol,Tokendata>
 *  - AssosiatedTokenAccounts: <tokenSymbol, AddressOfAta>
 *
 *
 * Load tokens we support data
 * Load their atas
 * Load serum amms shit
 * Load ray amms shit
 * Laod luts
 * Load oo
 *
 *
 */
export class Datastore {
    private payer: Keypair;
    private connection: Connection;

    protected _tokensInfo!: Map<string, TokenData>;
    protected _assosiatedTokenAccounts!: Map<string, AssosiatedTokenAccount>;
    protected _serumAmms!: Map<string, SerumAmm>;
    protected _raydiumAmms!: Map<string, RaydiumAmm>;
    protected _orcaAmms!: Map<string, OrcaAmm>;
    protected _lutStore!: AddressLookupTableStore;
    supportedAmms: Array<AutomateMarketMakers>;

    constructor(connection: Connection, payer: Keypair, supportedAmms: AutomateMarketMakers[]) {
        this.connection = connection;
        this.payer = payer;
        this.supportedAmms = supportedAmms;
    }

    async populate(supportedTokens: Array<string>, supportedMarkets: Array<string>, lutCacheStore?: string) {
        this._tokensInfo = await new TokenDataLoader().load(new Set(supportedTokens));

        this._assosiatedTokenAccounts = await new AssosiatedTokenAccountLoader(
            this.connection,
            this.payer.publicKey,
        ).load(this._tokensInfo);

        const serumDl = await new SerumDataLoader({
            tokenData: this._tokensInfo,
            connection: this.connection,
            owner: this.payer.publicKey,
        }).load(supportedMarkets);

        this._serumAmms = await new SerumFactory().create({ ...serumDl });

        const rayDl = await new RaydiumDataLoader({
            tokenData: this._tokensInfo,
            connection: this.connection,
            owner: this.payer.publicKey,
        }).load(supportedMarkets);

        this._raydiumAmms = await new RaydiumFactory().create({ ...rayDl });

        const orcaDL = await new OrcaDataLoader().load(supportedMarkets);
        this._orcaAmms = await new OrcaFactory().create({ ...orcaDL });

        this._lutStore = new AddressLookupTableStore(
            this.connection,
            this.payer.publicKey,
            this.supportedAmms,
            lutCacheStore,
        );
        await this._lutStore.deserializeFromFile();
        this.makeDataCaseInsensitive();
    }

    hasMarket(amm: AutomateMarketMakers, marketSymbol: string): boolean {
        switch (amm) {
            case AutomateMarketMakers.SRM: {
                return this._serumAmms.has(marketSymbol);
            }
            case AutomateMarketMakers.RAY: {
                return this._raydiumAmms.has(marketSymbol);
            }
            case AutomateMarketMakers.ORCA: {
                return this._orcaAmms.has(marketSymbol);
            }
            default: {
                return false;
            }
        }
    }

    public getAta(tokenSymbol: string): AssosiatedTokenAccount | undefined {
        return this._assosiatedTokenAccounts.get(tokenSymbol);
    }
    public addAta(tokenSymbol: string, ata: PublicKey) {
        this._assosiatedTokenAccounts.set(
            tokenSymbol,
            new AssosiatedTokenAccount(tokenSymbol, this._tokensInfo.get(tokenSymbol)!.mint, ata),
        );
    }
    public getTokenInfo(tokenSymbol: string): TokenData {
        return this._tokensInfo.get(tokenSymbol)!;
    }
    public doesTokenExist(tokenSymbol: string): boolean {
        return this._tokensInfo.has(tokenSymbol);
    }
    public getLut(amm: AutomateMarketMakers, market: string): AddressLookupTableAccount | undefined {
        return this._lutStore.getLut(amm, market);
    }
    /**
     *
     * @param amm amm
     * @param market market symbol
     * Adds addresses of the given market symbol in belonging to provided amm in a lut
     */
    public async extendLut(amm: AutomateMarketMakers, market: string): Promise<LutExtensionInstruction> {
        switch (amm) {
            case AutomateMarketMakers.SRM:
                return await this._lutStore.extendLut(amm, market, this._serumAmms.get(market)!.getAllAddresses());
            case AutomateMarketMakers.RAY:
                return await this._lutStore.extendLut(amm, market, this._raydiumAmms.get(market)!.getAllAddresses());
            case AutomateMarketMakers.ORCA:
                return await this._lutStore.extendLut(amm, market, this._orcaAmms.get(market)!.getAllAddresses());
            default:
                throw new Error("Invalid amm");
        }
    }
    public getOpenOrderAccount(marketSymbol: string): PublicKey | undefined {
        return this._serumAmms.get(marketSymbol)!.openOrdersAccount;
    }
    public addOpenOrderAccount(marketSymbol: string, openOrderAddress: PublicKey) {
        this._serumAmms.get(marketSymbol)!.updateOpenOrdersAccount(openOrderAddress);
    }
    public getAmmMarket(amm: AutomateMarketMakers, market: string): SerumAmm | RaydiumAmm | OrcaAmm {
        switch (amm) {
            case AutomateMarketMakers.SRM:
                return this._serumAmms.get(market)!;
            case AutomateMarketMakers.RAY:
                return this._raydiumAmms.get(market)!;
            case AutomateMarketMakers.ORCA:
                return this._orcaAmms.get(market)!;
        }
    }
    getLoadedData() {
        //Diagnostic function to log lists of loaded data
        return {
            loadedSerumMarkets: [...this._serumAmms.keys()].sort(),
            loadedRaydiumAmms: [...this._raydiumAmms.keys()].sort(),
            loadedOrcaAmms: [...this._orcaAmms.keys()].sort(),
            loadedTokens: [...this._tokensInfo.keys()].sort(),
            loadedAssosiatedTokenAccounts: [...this._assosiatedTokenAccounts.keys()].sort(),
        };
    }
    makeDataCaseInsensitive() {
        const tokensInfo: Map<string, TokenData> = new Map();
        const assosiatedTokenAccounts: Map<string, AssosiatedTokenAccount> = new Map();
        const serumAmms: Map<string, SerumAmm> = new Map();
        const raydiumAmms: Map<string, RaydiumAmm> = new Map();
        const orcaAmms: Map<string, OrcaAmm> = new Map();

        for (let [symbol, token] of this._tokensInfo) {
            tokensInfo.set(symbol.toLowerCase(), new TokenData(token.symbol.toLowerCase(), token.mint, token.decimals));
        }
        for (let [symbol, ata] of this._assosiatedTokenAccounts) {
            assosiatedTokenAccounts.set(
                symbol.toLowerCase(),
                new AssosiatedTokenAccount(ata.symbol.toLowerCase(), ata.tokenMint, ata.ataAddress),
            );
        }
        for (let [symbol, amm] of this._serumAmms) {
            serumAmms.set(symbol.toLowerCase(), amm);
        }
        for (let [symbol, amm] of this._raydiumAmms) {
            raydiumAmms.set(symbol.toLowerCase(), amm);
        }
        for (let [symbol, amm] of this._orcaAmms) {
            orcaAmms.set(symbol.toLowerCase(), amm);
        }

        this._tokensInfo = tokensInfo;
        this._assosiatedTokenAccounts = assosiatedTokenAccounts;
        this._serumAmms = serumAmms;
        this._raydiumAmms = raydiumAmms;
        this._orcaAmms = orcaAmms;
    }
}

# For Serum and Raydium

- Bids and Asks
- Market Symbol: baseMint-Quotemint
- Bid: Placing a bid on the above market will use "quoteMint" as input and "baseMint" as output
- Ask: Placing an ask on the above market will use "baseMint" as input and "quoteMint" as output
- Example:
  - Market: SRM-USDT
  - Bid: Input USDT, Output: SRM
  - Ask: Input SRM, Output USDT

## Serum Specific

- Swaps on some market fail due to 0x12e. Still have to figure out why they're failing
- Route Fares: Route fare rates are used to calculate minExchangeRate for the market which serves as the
- lower bound for trade price(slippage).
- Case: InputMint == BaseMint and OutputMint == QuoteMint or Side == Bid
- Fare rate = as mentioned in the incoming arb
- Case: InputMint == QuoteMint and OutputMint == BaseMint or Side == Ask
- Fare rate = 1/(as mentioned in the incoming arb)
- For serum swap instruction, we need the following addresses
  -  Payer
  -  New Token Accounts(Only if it's required to be created in a instruction) and they're signers as well
  -  Base vault
  -  QuoteVault of market
  -  Event Queue of market
  -  Token Accounts[owned by owner for mint involved in that swap]
  -  OpenOrder Account for that Market
  -  Market Own Address
  -  Request queue
  -  Market Bid
  -  Market Ask
  -  Dex pid
  -  Vault Signer ADdress of Dex(Serum)
  -  Token Program ID
  -  Associated Token Program Id
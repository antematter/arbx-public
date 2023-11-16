# NginArb

## Prerequisites

-   Node 17
-   git
-   .env

## Running

```ts
> yarn
> yarn start #development
> yarn test  #running unit tests
```

## Architecture

### Amms

This module contains logic to represent a market instance on any amm in our bot, fetch the market data of given markets and factories to mass create market instances of the amm.

### Arbitrage Command Builder

An `ArbitrageCommand` is a sequence of `SwapCommands` which contains all the information required to perform a swap. Each Amm has its own `SwapCommand` implementation containing all data required to perform a swap on that particular Amm.

### Arbitrage Instruction Builder

This component receives an `ArbitrageCommand` and creates `SwapInstruction`. Each Amm has its own `SwapInstruction` implementation.

### Datastore

This components contains the following data

-   Amm Markets and other data e.g open orders in case of Serum-Dex
-   Associated Token Accounts
-   Address Lookup Tables
-   Supported Tokens

### Cache

Contains static data. E.g Luts

### Address Lookup Table

This provides a high level API that abstracts away creation, extension, serialization and deserialization of Luts.

### Filters

Whenever an Arbitrage is received, it is passed through a series of filters that determine whether the arb is supported by our app. For example: filtering out arbs with below certain a profit potential or amms/markets.

### Handlers

Arbitrages can have certain preconditions required for the successful execution namely

-   Existence of LUT
-   Existence of Associate Token Accounts
-   Existence of open orders accounts

Handlers ensure that all those preconditions are met and return actions required to fulfill those preconditions.

### Arbitrage Dispatcher

Receives a raw arbitrage, passes it through filters and handlers and submits it to the Solana mainnet for execution

### Tokens

Convenience wrappers around `Token` and `AssociatedTokenAccounts` along with support to fetch them.

### Transaction Executor

Provides function for execution versioned and legacy transactions. We have enhance transactions to support `PreTransaction` and `PostTransaction` hooks

### Tests

Contains tests. Whenever you add a new component, make sure to add tests

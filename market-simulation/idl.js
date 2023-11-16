exports.IDL = {
  "version": "0.4.1",
  "name": "serum_swap",
  "instructions": [
    {
      "name": "initAccount",
      "docs": [
        "Convenience API to initialize an open orders account on the Serum DEX."
      ],
      "accounts": [
        {
          "name": "openOrders",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "market",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "dexProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "closeAccount",
      "docs": [
        "Convenience API to close an open orders account on the Serum DEX."
      ],
      "accounts": [
        {
          "name": "openOrders",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "destination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "dexProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "swap",
      "docs": [
        "Swaps two tokens on a single A/B market, where A is the base currency",
        "and B is the quote currency. This is just a direct IOC trade that",
        "instantly settles.",
        "",
        "When side is \"bid\", then swaps B for A. When side is \"ask\", then swaps",
        "A for B.",
        "",
        "Arguments:",
        "",
        "* `side`              - The direction to swap.",
        "* `amount`            - The amount to swap *from*",
        "* `min_exchange_rate` - The exchange rate to use when determining",
        "whether the transaction should abort."
      ],
      "accounts": [
        {
          "name": "market",
          "accounts": [
            {
              "name": "market",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "openOrders",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "requestQueue",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "eventQueue",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "bids",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "asks",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "orderPayerTokenAccount",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "coinVault",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "pcVault",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "vaultSigner",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "coinWallet",
              "isMut": true,
              "isSigner": false
            }
          ]
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "pcWallet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "dexProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "side",
          "type": {
            "defined": "Side"
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "minExchangeRate",
          "type": {
            "defined": "ExchangeRate"
          }
        }
      ]
    },
    {
      "name": "swapTransitive",
      "docs": [
        "Swaps two base currencies across two different markets.",
        "",
        "That is, suppose there are two markets, A/USD(x) and B/USD(x).",
        "Then swaps token A for token B via",
        "",
        "* IOC (immediate or cancel) sell order on A/USD(x) market.",
        "* Settle open orders to get USD(x).",
        "* IOC buy order on B/USD(x) market to convert USD(x) to token B.",
        "* Settle open orders to get token B.",
        "",
        "Arguments:",
        "",
        "* `amount`            - The amount to swap *from*.",
        "* `min_exchange_rate` - The exchange rate to use when determining",
        "whether the transaction should abort."
      ],
      "accounts": [
        {
          "name": "from",
          "accounts": [
            {
              "name": "market",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "openOrders",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "requestQueue",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "eventQueue",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "bids",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "asks",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "orderPayerTokenAccount",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "coinVault",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "pcVault",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "vaultSigner",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "coinWallet",
              "isMut": true,
              "isSigner": false
            }
          ]
        },
        {
          "name": "to",
          "accounts": [
            {
              "name": "market",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "openOrders",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "requestQueue",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "eventQueue",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "bids",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "asks",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "orderPayerTokenAccount",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "coinVault",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "pcVault",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "vaultSigner",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "coinWallet",
              "isMut": true,
              "isSigner": false
            }
          ]
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "pcWallet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "dexProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "minExchangeRate",
          "type": {
            "defined": "ExchangeRate"
          }
        }
      ]
    }
  ],
  "types": [
    {
      "name": "ExchangeRate",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "rate",
            "type": "u64"
          },
          {
            "name": "fromDecimals",
            "type": "u8"
          },
          {
            "name": "quoteDecimals",
            "type": "u8"
          },
          {
            "name": "strict",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "Side",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Bid"
          },
          {
            "name": "Ask"
          }
        ]
      }
    },
    {
      "name": "ErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "SwapTokensCannotMatch"
          },
          {
            "name": "SlippageExceeded"
          },
          {
            "name": "ZeroSwap"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "DidSwap",
      "fields": [
        {
          "name": "givenAmount",
          "type": "u64",
          "index": false
        },
        {
          "name": "minExchangeRate",
          "type": {
            "defined": "ExchangeRate"
          },
          "index": false
        },
        {
          "name": "fromAmount",
          "type": "u64",
          "index": false
        },
        {
          "name": "toAmount",
          "type": "u64",
          "index": false
        },
        {
          "name": "quoteAmount",
          "type": "u64",
          "index": false
        },
        {
          "name": "spillAmount",
          "type": "u64",
          "index": false
        },
        {
          "name": "fromMint",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "toMint",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "quoteMint",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "authority",
          "type": "publicKey",
          "index": false
        }
      ]
    }
  ],
  "metadata": {
    "address": "22bcx5mVqVgWkey4Y2xVA7NdaYomCDx6TTAgJdRDJmoK"
  }
}
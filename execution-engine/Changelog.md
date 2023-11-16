[0.1.1]

change/swap-input-perfect: Changes how much pertantange amount of output tokens is used as input for the next swap leg in turn.

[0.1.2]
feature/open-order-serialization: Serializes the addresses of all serum open orders accounts created.

[0.1.3]
feature/cloud-logs: Adds feature for storing transaction signatures and public keys that issued them on cloud. Store them on cache dir.

[0.1.4]
Enabled the reading of .env file. It must have a variable named `NODE_ENV` with one of two values: `development` and `production`.

[0.1.5]
Improved logs, fixed a bug with saving of transaction signatures in cloud, enabled a slack hook transport for logs.

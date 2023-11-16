1. Read and Validate config
2. Backend should authenticate+authorize in a single-step client using challenge response
3. Fetch NFTs of the incoming private key using Metaplex SDK
4. At least one of the NFT must be a worthless pixel(should have WPIX symbol)
5. Query a backend to fetch details about active instances which should be less than the number of owned wps
6. PublicKey : [].length <= owned NFTS
7. Update backend before firing up the instance
8. Each instance should inform backend every 15 min about it being active

//sha256(sha256(nonce)+publicKey+Sha256(publicKey)+nonce)

//Hit the nonce endpoint to get a nonce
//Send activation request to server with the challenge response answer and if that is correct, server will return previous response hashed again using id+url endpoint as salt and test that

Oct 13 TODO:

- Basic refactoring
- Add orca swap
- Storing OO Accounts in file and keeping that updated
- Adding Transaction Types for getting better logs
- Permanent Sol ATA
- Option to Disable OO after trade?
- Executes Arbs for only markets for which we have luts
- Crete Fixed Associated Token account for SOL(So11111111111111111111111111111111111111112) having name Wrapped SOL (SOL)
- Add raydium swap
- If any arbitrage involves a sol account; openinig sol should be the first and closing it should be the last transaction
- For debugging purposes, all open order accounts must be closed after usage

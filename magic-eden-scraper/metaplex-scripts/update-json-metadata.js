const { Metaplex, keypairIdentity } = require("@metaplex-foundation/js");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { base58_to_binary } = require("base58-js");

const connection = new Connection("http://185.209.177.4:8899");
const authority = Keypair.fromSecretKey(
  base58_to_binary(process.env.METAPLEX_PRIVATE_KEY)
);
const metaplex = new Metaplex(connection);
metaplex.use(keypairIdentity(authority));

const main = async () => {
  if (process.argv.length < 3) {
    console.error("Please provide a mint address");
    process.exit(1);
  }

  let mintAddress = null;
  try {
    mintAddress = new PublicKey(process.argv[2]);
  } catch {
    console.error("Invalid mint address");
    process.exit(1);
  }

  const metaplex_metadata = await metaplex
    .nfts()
    .findByMint({ mintAddress })
    .run();

  await metaplex
    .nfts()
    .update({
      nftOrSft: metaplex_metadata,
      uri: `https://mint-api.worthlesspixels.com/json/${process.argv[2]}-nobot.json`,
    })
    .run();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

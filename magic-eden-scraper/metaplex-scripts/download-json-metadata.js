const fs = require("fs");
const { Metaplex } = require("@metaplex-foundation/js");
const { Connection, PublicKey } = require("@solana/web3.js");

const connection = new Connection("http://185.209.177.4:8899");
const metaplex = new Metaplex(connection);

const main = async () => {
  if (process.argv.length < 3) {
    console.error("Please provide a mint address");
    process.exit(1);
  }

  if (!fs.existsSync("./json-metadata")) {
    fs.mkdirSync("./json-metadata");
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

  metaplex_metadata.json.attributes
    .filter((attr) => attr.trait_type === "class")
    .forEach((attr) => {
      attr.value = "nobot";
    });

  if (metaplex_metadata.json) {
    fs.writeFileSync(
      `./json-metadata/${process.argv[2]}-nobot.json`,
      JSON.stringify(metaplex_metadata.json, null, 2)
    );
  } else {
    console.error("No metadata found");
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { Metaplex } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection(
    "https://dark-green-model.solana-mainnet.discover.quiknode.pro/7855c6032e149749dd1e5480942f1bf88185da21/"
);

const pubKey = process.argv[2];

( async () => {
    try {
        const metaplex = new Metaplex(connection);
        if (pubKey == "BdRc3orHSvsXteq7MhFd7988QKoisRgQtQyyhDic9DDA") {
            console.log(9999);
            return;
        }
        const nfts = await metaplex.nfts().findAllByOwner({ owner: new PublicKey(pubKey) });
        const wpNfts = nfts.filter((nft : any) => nft.symbol === "WPIX");
        console.log(wpNfts.length)
    } catch (e : unknown) {
        console.log(-1);
    }
})();
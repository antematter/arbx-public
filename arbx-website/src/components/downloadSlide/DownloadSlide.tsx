import { FC, useState } from "react";
import { DownloadSlidesProps } from "./DownlaodSlideProps";
import { motion } from "framer-motion";
import { Metaplex, Metadata } from "@metaplex-foundation/js";

import { PublicKey, Connection } from "@solana/web3.js";

const WORTHLESS_PIXELS_NFTS_SYMBOL = "WPIX";
const SOLANA_RPC_URL = "http://185.209.177.4:8899";

const DownloadSlide: FC<DownloadSlidesProps> = ({ onClose }) => {
  const [address, setAddress] = useState("");
  const [issueMessage, setIssueMessage] = useState("");

  const [displayContent, setDisplayContent] = useState<
    "inputAddress" | "loader" | "download"
  >("inputAddress");

  const authenticationSearchByNfts = async () => {
    let nftPixelOwned = false;
    let userPublicKey = "";

    // get public key from private key
    /**/
    try {
      userPublicKey = address;
      PublicKey.isOnCurve(userPublicKey.toString());
    } catch {
      setIssueMessage("You have entered an invalid public key.");
      console.log("You have entered an invalid public key.");

      setDisplayContent("inputAddress");

      return;
    }

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const metaplex = new Metaplex(connection);
    const userNfts = await metaplex
      .nfts()
      .findAllByOwner({ owner: new PublicKey(userPublicKey) });

    nftPixelOwned = false;
    userNfts.forEach((nft) => {
      const aNFT = nft as Metadata;
      console.log("symbol", aNFT.symbol);
      if (aNFT.symbol === WORTHLESS_PIXELS_NFTS_SYMBOL) {
        nftPixelOwned = true;
        console.log("i am in");
      }
    }); //setDisplayContent("download");

    nftPixelOwned
      ? setDisplayContent("download")
      : setDisplayContent("inputAddress");
  };

  return (
    <motion.div className="flex flex-col w-[80vw] h-screen  bg-black opacity-95    ">
      <div className=" absolute flex justify-end h-fit w-[80vw] p-10  z-10    ">
        <button
          className="absolute flex justify-end h-fit w-fit"
          onClick={onClose}
        >
          CLOSE X
        </button>
      </div>
      <motion.div className=" relative flex flex-col h-full w-full border-white border-l-2  justify-center items-center gap-2 ">
        {
          <img
            className=" h-[6.5rem] w-[8rem] mb-5"
            src={require("../../data/images/logoWithWording.png")}
            alt="arbx logo"
          />
        }
        {displayContent === "inputAddress" && (
          <input
            className="bg-black text-white border-white border-2 placeholder-white text-sm tracking-wide	 focus:outline-none w-[18rem]  py-3 px-5 rounded-xl "
            placeholder="Enter assigned public key"
            onChange={(e) => setAddress(e.target.value)}
          />
        )}
        {displayContent === "inputAddress" && (
          <button
            className="py-2 w-[18rem] rounded-xl font-semibold bg-white text-black"
            onClick={async () => {
              console.log("authentication in process");
              setDisplayContent("loader");
              console.log("displayContent", displayContent);
              await authenticationSearchByNfts();
              console.log("displayContent", displayContent);
              console.log("authentication complete");
              console.log("issue message:", issueMessage);
            }}
          >
            <p>Enter</p>
          </button>
        )}
        {displayContent === "download" && (
          <button
            className="py-2 w-[18rem] rounded-xl font-semibold bg-white text-black"
            onClick={async () => {
              console.log("authentication in process");
              await authenticationSearchByNfts();
              console.log("authentication complete");
              console.log("issue message:", issueMessage);
            }}
          >
            <a
              href="https://github.com/antematter/arbx-public/releases/download/v0.1.0/ArbX.Console_0.1.0_x64_en-US.msi.zip"
              download
            >
              <p>Download</p>
            </a>
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};

export default DownloadSlide;

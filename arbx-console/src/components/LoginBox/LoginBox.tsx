import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { FC } from 'react';
import { LoginBoxProps } from './LoginBox.type';
import { Frame } from '@react95/core';
import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import { Metaplex, Metadata } from '@metaplex-foundation/js';
import { fetch } from '@tauri-apps/api/http';
import { NFTData } from '../Arbx/Arbx.type';
import lottie from 'lottie-web';
import { Console } from 'console';

const WORTHLESS_PIXELS_NFTS_SYMBOL = 'WPIX';
const LoginBoxBody: FC<LoginBoxProps> = ({ setNftsCount, setNftDataArray, setGlobalRpcUrl }) => {
  const [address, setAddress] = useState('');
  const [rpcUrl, setrpcUrl] = useState('http://');

  const [addressDisplayError, setAddressDisplayError] = useState(false);
  const [issueMessage, setIssueMessage] = useState('');
  const [showLoader, setShowLoader] = useState(false);
  const blackLoader = useRef(null);

  useEffect(() => {
    lottie.loadAnimation({
      container: blackLoader.current as unknown as Element,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: require('../../data/json/blackLoader.json')
    });
  }, [showLoader]);

  const authenticationSearchByNfts = async () => {
    let userWorthlessPixelNftsCount = 0;
    let userPublicKey = '';

    // get public key from private key
    /**/
    try {
      const userPrivateKeyUint8Array = bs58.decode(address);
      const userPrivateKey = Keypair.fromSecretKey(userPrivateKeyUint8Array);
      userPublicKey = userPrivateKey.publicKey.toString();
      PublicKey.isOnCurve(userPublicKey.toString());
    } catch {
      setIssueMessage('You have entered an invalid private key.');

      setAddressDisplayError(true);
      return;
    }

    let connection;
    let metaplex;
    let userNfts;
    try {
      connection = new Connection(rpcUrl as string, 'confirmed');
      await connection.getVersion();
      metaplex = new Metaplex(connection);
      userNfts = await metaplex.nfts().findAllByOwner({ owner: new PublicKey(userPublicKey) });
      console.log('rpcUrl', rpcUrl);
    } catch {
      console.log('error');
      setIssueMessage('Invalid Solana RPC URL entered');
      setAddressDisplayError(true);
      return;
    }

    userNfts.forEach(async (nft) => {
      const aNFT = nft as Metadata;
      if (aNFT.symbol === WORTHLESS_PIXELS_NFTS_SYMBOL) {
        userWorthlessPixelNftsCount++;

        try {
          const nftImage = await fetch(aNFT.uri, {
            method: 'GET',
            timeout: 30
          })
            .then((res) => res.data)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((data) => (data as any).image);

          const nftData: NFTData = {
            image: nftImage,
            mint: aNFT.mintAddress
          };

          setNftDataArray((nftDataArray) => {
            return [...nftDataArray, nftData];
          });
        } catch {
          console.error('Error: failed to fetch nft image');
        }
      }
    });
    if (userWorthlessPixelNftsCount <= 0) {
      setIssueMessage('You do not own any Worthless Pixels.');
      setAddressDisplayError(true);
    } else {
      setGlobalRpcUrl(rpcUrl);
      setNftsCount(userWorthlessPixelNftsCount);
    }
  };

  return (
    <div className="flex flex-col gap-5 pt-2 px-2">
      <div className="flex bg-blue-900 text-white gap-x-5 px-2 py-1 items-center ">
        <p className="break-words w-[80%]">Enter Private Key</p>
      </div>
      <div className="flex flex-col justify-center items-center gap-8">
        <div className="flex justify-center items-center gap-3">
          <img className="h-[4rem] w-[4rem]" src={require('../../data/images/arbxLogo.png')} />
          <img src={require('../../data/images/arbxName.png')} />
        </div>
        <div className="flex flex-col justify-center items-center font-W95FA">
          <img src={require('../../data/images/welcomeAndDescription.png')} />
        </div>
        <div className="flex flex-col ">
          <div className="flex flex-col justify-start h-[4rem]">
            <div className=" flex gap-2 w-full justify-between">
              <p>Key</p>
              <input
                className={
                  'shadow-arbxInputField w-[25rem] h-[2rem] ' +
                  (addressDisplayError ? ' text-red-600' : '')
                }
                type="text"
                onChange={(event) => {
                  setAddressDisplayError(false);
                  setAddress(event.target.value);
                }}
              />
            </div>
          </div>
          <div className="flex flex-col justify-start h-[4rem]">
            <div className=" flex gap-2 w-full justify-between">
              <p>RPC URL</p>
              <input
                className={
                  'shadow-arbxInputField w-[25rem] h-[2rem] ' +
                  (addressDisplayError ? ' text-red-600' : '')
                }
                type="text"
                onChange={(event) => {
                  setAddressDisplayError(false);
                  setrpcUrl(event.target.value);
                }}
              />
            </div>
            {addressDisplayError && <p className="text-red-600 ml-[4.2rem]">{issueMessage}</p>}
          </div>
          <button
            className="shadow-arbxButton w-[25rem] h-[2rem] ml-[4.2rem] "
            onClick={async () => {
              setAddressDisplayError(false);
              setShowLoader(true);
              setIssueMessage('');
              await authenticationSearchByNfts();
              setShowLoader(false);
            }}>
            <div className="flex justify-center">
              {showLoader ? (
                <div className="blackLoader h-[2rem] w-[2rem]" ref={blackLoader}></div>
              ) : (
                <p>Enter</p>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const LoginBox: FC<LoginBoxProps> = ({ setNftsCount, setNftDataArray, setGlobalRpcUrl }) => {
  return (
    <div className="flex justify-center items-center h-screen bg-teal-700">
      <Frame w={600} h={500}>
        <div className="text-black h-full">
          <LoginBoxBody
            setNftsCount={setNftsCount}
            setNftDataArray={setNftDataArray}
            setGlobalRpcUrl={setGlobalRpcUrl}
          />
        </div>
      </Frame>
    </div>
  );
};

export default LoginBox;

//

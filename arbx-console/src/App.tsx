import React from 'react';
import { ThemeProvider } from '@react95/core';

import { BrowserRouter } from 'react-router-dom';
import { useState } from 'react';

import LoginBox from './components/LoginBox/LoginBox';

import Arbx from './components/Arbx/Arbx';
import { NFTData } from './components/Arbx/Arbx.type';
function App() {
  const [nftsCount, setNftsCount] = useState(0);
  const [nftDataArray, setNftDataArray] = useState<NFTData[]>([]);
  const [globalRpcUrl, setGlobalRpcUrl] = useState('http://');

  return (
    <BrowserRouter>
      <ThemeProvider>
        <div className="top-div">
          {nftsCount > 0 && (
            <Arbx
              nftDataArray={nftDataArray}
              globalRpcUrl={globalRpcUrl}
              onLogout={() => {
                setNftsCount(0);
                setNftDataArray([]);
              }}
            />
          )}
          {nftsCount <= 0 && (
            <LoginBox
              setNftsCount={setNftsCount}
              setNftDataArray={setNftDataArray}
              setGlobalRpcUrl={setGlobalRpcUrl}
            />
          )}
        </div>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;

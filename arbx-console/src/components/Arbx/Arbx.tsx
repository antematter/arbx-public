import '@react95/icons/icons.css';

import React from 'react';
import { List, TaskBar } from '@react95/core';
import { useHistory } from 'react-router-dom';
import { FC } from 'react';

import { useState } from 'react';
import {
  Calculator,
  HelpBook,
  Inetcpl1313,
  Progman35,
  Inetcpl1305,
  Shell32142,
  Awfxcg321304,
  Computer,
  Mdisp321,
  D3Maze100,
  Explorer103,
  Shell323,
  Progman20,
  Mailnews22,
  Mcm502,
  Computer3,
  Keys
} from '@react95/icons';

import { ArbxProps } from './Arbx.type';
import ArbxFolder from '../ArbXFolder/ArbXFolder';
import LiveArbFeed from '../LiveArbFeed/LiveArbFeed';
import JupiterBotInputMenu from '../JupiterBot/JupiterBotInputMenu';
import JupiterBotFeed from '../JupiterBot/JupiterBotFeed';
import { useEffect, useRef } from 'react';
import Webamp from 'webamp';
import butterchurnPresets from 'butterchurn-presets';
import isButterchurnSupported from 'butterchurn/lib/isSupported.min';
import Coins95 from '../Coins95/Coins95';
import { initialTracks } from '../../data/webampData';
import ArbxBotInputMenu from '../ArbxBot/ArbxBotInputMenu/ArbxBotInputMenu';
import { userInputValues } from '../JupiterBot/JupiterBot.type';
import SkiFree from '../SkiFree/SkiFree';
import { invoke } from '@tauri-apps/api';

const initialDisplayValues = {
  MarketValue: false,
  LiveArbFeed: false,
  WinAMP: false,
  JupiterBotInputMenu: false,
  JupiterBotFeed: false,
  ArbxBotInputMenu: false,
  SkiFree: false
};

const defaultJupiterUserInput: userInputValues = {
  token: 'token place holder',
  tokenAddress: ' token address place holder',
  amount: 0,
  minProfit: 0,
  slippage: '0.01',
  privateKey: '',
  action: 'Action place holder'
};
//nftImages
const Arbx: FC<ArbxProps> = ({ nftDataArray, onLogout, globalRpcUrl }) => {
  const webampContainerRef = useRef<HTMLDivElement>(null);
  const [webampInstance, setWebampInstance] = useState<Webamp | null>(null);
  const [display, setDisplay] = useState(initialDisplayValues);
  const [jupiterUserInput, setJupiterUserInput] = useState(defaultJupiterUserInput);
  const [arbxFeatures, setArbxfeatures] = useState<{ inUse: boolean; feature: JSX.Element }[]>([]);

  const arbxHistory = useHistory();

  useEffect(() => {
    if (window.location.href.indexOf('market-watch') > -1) {
      arbxHistory.push('/');
    }
  }, []);

  useEffect(() => {
    console.log(display);
    setArbxfeatures([
      {
        inUse: display.LiveArbFeed,
        feature: (
          <LiveArbFeed
            onClose={() => {
              setDisplay({ ...display, LiveArbFeed: false });
            }}
          />
        )
      },
      {
        inUse: display.MarketValue,
        feature: (
          <Coins95
            onClose={() => {
              setDisplay({ ...display, MarketValue: false });
              arbxHistory.push('/');
            }}
          />
        )
      },
      {
        inUse: display.SkiFree,
        feature: <SkiFree onClose={() => setDisplay({ ...display, SkiFree: false })} />
      },
      {
        inUse: display.JupiterBotInputMenu,
        feature: (
          <JupiterBotInputMenu
            onClose={() => {
              setDisplay({ ...display, JupiterBotInputMenu: false, JupiterBotFeed: false });
            }}
            displayJupiterBot={() => {
              setDisplay({ ...display, JupiterBotFeed: true });
            }}
            getUserInput={(data: userInputValues) => {
              setJupiterUserInput(data);
            }}
          />
        )
      },
      {
        inUse: display.JupiterBotFeed,
        feature: (
          <JupiterBotFeed
            inputData={jupiterUserInput}
            onClose={() => {
              setDisplay({ ...display, JupiterBotFeed: false });
            }}
          />
        )
      },
      {
        inUse: display.ArbxBotInputMenu,
        feature: (
          <ArbxBotInputMenu
            nftDataArray={nftDataArray}
            globalRpcUrl={globalRpcUrl}
            onClose={() => {
              setDisplay({ ...display, ArbxBotInputMenu: false });
            }}
          />
        )
      }
    ]);
  }, [display]);

  useEffect(() => {
    if (webampContainerRef.current) {
      const webampInstance = new Webamp({
        zIndex: 999,
        initialTracks: initialTracks,
        __butterchurnOptions: {
          importButterchurn: () => import('butterchurn'),
          getPresets: () => {
            const presets = butterchurnPresets.getPresets();
            return Object.keys(presets).map((name) => {
              return {
                name,
                butterchurnPresetObject: presets[name]
              };
            });
          },
          butterchurnOpen: isButterchurnSupported()
        },
        __initialWindowLayout: {
          main: { position: { x: 0, y: 0 } },
          equalizer: { position: { x: 0, y: 116 } },
          playlist: { position: { x: 0, y: 232 }, size: [0, 4] },
          milkdrop: { position: { x: 275, y: 0 }, size: [7, 12] }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      webampInstance.renderWhenReady(webampContainerRef.current);
      webampInstance.close();
      setWebampInstance(webampInstance);
    }

    return () => {
      if (webampInstance) webampInstance.dispose();
    };
  }, []);

  useEffect(() => {
    if (display.WinAMP) {
      webampInstance?.reopen();
    } else {
      webampInstance?.close();
    }
  }, [display.WinAMP]);

  useEffect(() => {
    webampInstance?.onClose(() => {
      setDisplay({ ...display, WinAMP: false });
    });
  }, [display]);

  return (
    <div className="bg-wallPaper1 h-screen overflow-hidden">
      <div className="flex  text-white space-x-4 w-fit pt-5">
        <div className="flex flex-col space-y-4 ml-4 gap-1">
          <ArbxFolder name={'My Computer'} icon={<Computer variant="32x32_4" />} />
          <ArbxFolder name={'Trash'} icon={<Shell32142 variant="32x32_4" />} />
          <ArbxFolder name={'Key Management'} icon={<Inetcpl1305 variant="32x32_4" />} />
          <ArbxFolder
            name={'WinAMP'}
            icon={<img src="/images/winamp-icon.png" alt="WinAMP Icon" />}
            onClick={() => {
              setDisplay({ ...display, WinAMP: true });
            }}
          />
          <ArbxFolder name={'Calculator'} icon={<Calculator variant="32x32_4" />} />
          <ArbxFolder name={'Connect'} icon={<Awfxcg321304 variant="32x32_4" />} />
          <ArbxFolder name={'Help'} icon={<HelpBook variant="32x32_4" />} />
        </div>

        <div className="flex flex-col w-16  space-y-4">
          <ArbxFolder name={'Browser'} icon={<Inetcpl1313 variant="32x32_4" />} />
          <ArbxFolder name={'Wallet'} icon={<Mcm502 variant="32x32_4" />} />
          <ArbxFolder
            name={'Market Watch'}
            icon={<D3Maze100 variant="32x32_4" />}
            onClick={() => {
              arbxHistory.push('/market-watch/coins');
              setDisplay({ ...display, MarketValue: true });
            }}
          />
          <ArbxFolder name={'Next'} icon={<Explorer103 variant="32x32_4" />} />
          <ArbxFolder name={'Strategy'} icon={<Mdisp321 variant="32x32_4" />} />
          <ArbxFolder name={'News'} icon={<Progman35 variant="32x32_4" />} />
          <ArbxFolder
            name={'Live Arbitrage Feed'}
            icon={
              <Shell323
                variant="32x32_4"
                onClick={() => {
                  setDisplay({ ...display, LiveArbFeed: true });
                }}
              />
            }
          />
        </div>
        <div className="flex flex-col w-16  space-y-4">
          <ArbxFolder
            name={'Jupiter Bot'}
            icon={<Progman20 variant="32x32_4" />}
            onClick={() => {
              setDisplay({ ...display, JupiterBotInputMenu: true });
            }}
          />
          <ArbxFolder
            name={'Arbx Bots'}
            icon={<Mailnews22 variant="32x32_4" />}
            onClick={() => {
              setDisplay({ ...display, ArbxBotInputMenu: true });
            }}
          />
          {/* <ArbxFolder
            name={'Ski Free'}
            icon={<Mailnews22 variant="32x32_4" />}
            onClick={() => {
              setDisplay({ ...display, SkiFree: true });
            }}
          /> */}
        </div>

        {/* display grid */}
        <div className="pl-[5rem]">
          {arbxFeatures.map((feature, index) => {
            if (feature.inUse) {
              return <div key={index}>{feature.feature}</div>;
            }
          })}

          <div ref={webampContainerRef}></div>
        </div>
      </div>

      <TaskBar
        list={
          <List>
            <List.Item icon={<Keys variant="32x32_4" />} onClick={onLogout}>
              Log Out
            </List.Item>
            <List.Item
              icon={<Computer3 variant="32x32_4" />}
              onClick={() => {
                setDisplay(initialDisplayValues);
                setTimeout(() => {
                  invoke('kill_app');
                }, 1000);
              }}>
              Shut Down
            </List.Item>
          </List>
        }></TaskBar>
    </div>
  );
};

export default Arbx;

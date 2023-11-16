import React from 'react';
import { FC, useEffect, useState } from 'react';
import { runJupiter, stopJupiter } from './jupiter-bot';
import { JupiterBotFeedProps, JupiterBotFeedBodyProps, JupiterBotOutput } from './JupiterBot.type';
import ArbsGraph from '../ArbxGraph/ArbsGraph';
import { ArbsGraphData } from '../ArbxGraph/ArbxGraph.type';
import ArbxButton from '../ArbxButton/ArbxButton';
import { Frame, Modal } from '@react95/core';
import { Progman20 } from '@react95/icons';

const JupiteBotFeedBackPlaceHolder: JupiterBotOutput = {
  tradeHistory: [
    {
      buy: true,
      date: '9/23/2022, 5:21:06 PM',
      error: null,
      expectedOutAmount: '0.010031',
      expectedProfit: 0.31,
      inAmount: '0.010000',
      inputToken: 'USDC',
      outAmount: '0.010031',
      outputToken: 'USDC',
      performanceOfTx: 2981.599999997765,
      profit: 0.31
    }
  ],
  started: 'status palceholder',
  timestamp: null,
  tradingToken: null,
  lookupLatency: null,
  minInterval: null,
  queueStatus: 'status placehiolder',
  routes: 0,
  strategy: null,
  statusMessage: 'Fetching Arbs',
  totalSuccessfulBuys: 0,
  totalSuccessfulSells: 0,
  totalFailedBuys: 0,
  totalFailedSells: 0,
  profit: 0,
  slippage: 'profitOrKill',
  latestInAmount: 'status placeHolder',
  latestOutAmount: 'status placeHolder',
  profitData: [],
  maxBuy: '0',
  maxSell: '0',
  tokenADetails: {
    currentBalance: '0',
    lastBalance: '0',
    initialBalance: '0'
  }
};

const DefaultDisplayGrid = {
  graph: true,
  tradeHistry: false
};

const JupiterBotFeedBody: FC<JupiterBotFeedBodyProps> = ({ inputData }) => {
  const [JupiterFeedback, setJupiterFeedback] = useState<JupiterBotOutput>(
    JupiteBotFeedBackPlaceHolder
  );
  const [displayGrid, setdisplayGrid] = useState(DefaultDisplayGrid);

  const [jupiterProfitData, setJupiterProfitData] = useState<ArbsGraphData[]>([]);

  useEffect(() => {
    const jupiterInput = {
      tokenA: {
        symbol: inputData.token,
        address: inputData.tokenAddress
      },
      slippage: inputData.slippage as unknown as string,
      minPercProfit: inputData.minProfit as unknown as string,
      tradeSize: {
        value: inputData.amount,
        strategy: 'cumulative'
      },
      walletPrivateKey: inputData.privateKey,
      sideBuy: inputData.action === 'Buy' ? true : false
    };

    runJupiter(jupiterInput, (botState) => {
      setJupiterFeedback({ ...botState, tradeHistory: botState.tradeHistory.slice().reverse() });

      let i = 0;
      const newProfitData: ArbsGraphData[] = [];

      botState.profitData.forEach((profitData) => {
        i += 1;

        newProfitData.push({ index: i, profit: profitData });
      });

      setJupiterProfitData(() => {
        return newProfitData;
      });
    });
    return () => {
      stopJupiter();
    };
  }, [inputData]);
  return (
    <div className=" flex flex-col h-fit ">
      <Frame w={829} h={275} padding={1} bg="black" boxShadow="in">
        {displayGrid.graph && (
          <div className="flex flex-col h-full">
            <div className="h-[90%] bg-black">
              <ArbsGraph data={jupiterProfitData} />
            </div>
            <div className="flex bg-zinc-800 h-[10%]">
              <div className="flex gap-4 pl-4">
                <p>Max ({inputData.action === 'Buy' ? 'Buy' : 'Sell'}):</p>
                <div className="flex">
                  <p className="text-green-400">
                    {inputData.action === 'Buy' ? JupiterFeedback.maxBuy : JupiterFeedback.maxSell}
                  </p>
                  <p>%</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {displayGrid.tradeHistry && (
          <div
            className={
              ' flex w-full h-full  bg-white ' +
              (JupiterFeedback.tradeHistory.length > 7 ? 'overflow-y-scroll' : 'overflow-y-hidden')
            }>
            <table className=" flex flex-col table-fixed w-full  ">
              <tr className="flex justify-around items-center min-w-full text-black bg-gray91">
                <th className="flex  justify-center   w-[5.9rem] text-xs font-normal py-2 ">
                  Time Stamp
                </th>
                <th className="flex  justify-center  w-[5.9rem] text-xs font-normal py-2 ">
                  Slide
                </th>
                <th className="flex  justify-center  w-[5.9rem] text-xs font-normal py-2 ">In</th>
                <th className="flex  justify-center  w-[5.9rem] text-xs font-normal py-2 ">Out</th>
                <th className="flex  justify-center  w-[5.9rem] text-xs font-normal py-2 ">
                  Profit
                </th>
                <th className="flex  justify-center  w-[5.9rem] text-xs font-normal py-2 ">
                  Exp.Profit
                </th>

                <th className="     w-[5.9rem] text-xs font-normal  py-2 ">Error</th>
              </tr>

              {
                // use reverse to show the latest trade at the top
                JupiterFeedback.tradeHistory.map((feed, index) => (
                  <tr
                    key={index}
                    className={
                      'flex justify-around min-w-full ' +
                      (index % 2 === 1 ? 'bg-arbxAltRowColor' : '')
                    }>
                    <th className="text-blue-800 w-[5.9rem] text-xs px-1">{feed.date}</th>
                    <th className="text-blue-800 w-[5.9rem] text-xs px-1">{inputData.action}</th>
                    <th className="text-blue-800 w-[5.9rem] text-xs px-1">
                      <div className="flex flex-col">
                        <p>{feed.inAmount}</p>
                        <p>{feed.inputToken}</p>
                      </div>
                    </th>
                    <th className="text-blue-800 w-[5.9rem] text-xs px-1">
                      <div className="flex flex-col">
                        <p>{feed.outAmount}</p>
                        <p>{feed.inputToken}</p>
                      </div>
                    </th>
                    <th
                      className={
                        ' w-[5.9rem] text-xs break-words px-1 ' +
                        ((feed.profit as number) < 0 ? ' text-red-400 ' : ' text-green-400 ')
                      }>
                      {feed.profit}
                    </th>
                    <th
                      className={
                        ' w-[5.9rem] text-xs break-words px-1 ' +
                        ((feed.profit as number) < 0 ? ' text-red-400 ' : ' text-green-400 ')
                      }>
                      {feed.expectedProfit}
                    </th>
                    <th className="text-blue-800 w-[5.9rem] text-xs px-1">
                      {feed.error === null ? '-' : feed.error}
                    </th>
                  </tr>
                ))
              }
            </table>
          </div>
        )}
      </Frame>
      <div className="flex justify-between py-4 px-2">
        <div className="flex gap-4">
          <ArbxButton
            text="Graph"
            focused={displayGrid.graph}
            onClick={() => {
              setdisplayGrid({ graph: true, tradeHistry: false });
            }}
          />
          <ArbxButton
            text="Trade History"
            focused={displayGrid.tradeHistry}
            onClick={() => {
              setdisplayGrid({ graph: false, tradeHistry: true });
            }}
          />
        </div>
        <div className="flex w-[20%] gap-1 text-xs">
          <p className="text-black">Status:</p>
          <p className="text-arbxPurple">{JupiterFeedback.statusMessage}</p>
        </div>
      </div>
      <div>
        <hr className="border-t-zinc-800 " />
        <hr className="border-t-white" />
      </div>
      <div className="flex justify-between items-center text-xxs  text-black  w-full h-[7.7rem] pt-2 ">
        <div className="flex flex-col shadow-arbxFrame h-full w-[15%]">
          <div className="flex flex-col justify-around shadow-arbxFrame h-full w-full   p-2">
            <div>
              <p>Successful {inputData.action === 'Buy' ? 'Buy' : 'Sell'}</p>
              <div className="flex justify-start shadow-arbxInputField bg-white py-1 pl-2  w-[6rem] text-green-400">
                <p className="text-xs">
                  {inputData.action === 'Buy'
                    ? JupiterFeedback.totalSuccessfulBuys
                    : JupiterFeedback.totalSuccessfulSells}
                </p>
              </div>
            </div>
            <div>
              <p>Failed {inputData.action === 'Buy' ? 'Buy' : 'Sell'}</p>
              <div className="flex justify-start shadow-arbxInputField bg-white py-1 pl-2 w-[6rem] text-red-400">
                <p className="text-xs">
                  {inputData.action === 'Buy'
                    ? JupiterFeedback.totalFailedBuys
                    : JupiterFeedback.totalFailedSells}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col shadow-arbxFrame  h-full w-[83%] ">
          <div className="flex flex-col justify-around shadow-arbxFrame h-full w-full   p-2">
            <div className="flex justify-start  gap-4">
              <div>
                <p>Current Balance</p>
                <div className="flex justify-between shadow-arbxInputField bg-white py-1 px-2 w-[10rem] text-arbxTextBlue">
                  <p className="text-xs">{JupiterFeedback.tokenADetails.currentBalance}</p>
                  <p className="text-xs">{inputData.token}</p>
                </div>
              </div>
              <div>
                <p>Initial Balance</p>
                <div className="flex justify-between shadow-arbxInputField bg-white py-1 px-2 w-[10rem] text-arbxTextBlue">
                  <p className="text-xs">{JupiterFeedback.tokenADetails.initialBalance}</p>
                  <p className="text-xs">{inputData.token}</p>
                </div>
              </div>
              <div>
                <p>Slippage</p>
                <div className="flex justify-start shadow-arbxInputField bg-white py-1 px-2 w-[10rem] text-arbxTextDarkGreen">
                  <p className="text-xs">{inputData.slippage}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-start  gap-4">
              <div>
                <p>Last Balance</p>
                <div className="flex justify-between shadow-arbxInputField bg-white py-1 px-2 w-[10rem] text-arbxTextBlue">
                  <p className="text-xs">{JupiterFeedback.tokenADetails.lastBalance}</p>
                  <p className="text-xs">{inputData.token}</p>
                </div>
              </div>
              <div>
                <p>Profit</p>
                <div
                  className={
                    'flex justify-start shadow-arbxInputField bg-white py-1 px-2 w-[10rem] ' +
                    (JupiterFeedback.profit >= 0 ? 'text-arbxTextLightGreen' : 'text-red-400')
                  }>
                  <p className="text-xs">{JupiterFeedback.profit}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const JupiterBotFeed: FC<JupiterBotFeedProps> = ({ onClose, inputData }) => {
  return (
    <div className="ml-[400px]">
      <Modal
        width="845"
        height="500"
        icon={<Progman20 variant="32x32_4" />}
        title="Jupiter Feed"
        closeModal={onClose}>
        <JupiterBotFeedBody inputData={inputData} />
      </Modal>
    </div>
  );
};
export default JupiterBotFeed;

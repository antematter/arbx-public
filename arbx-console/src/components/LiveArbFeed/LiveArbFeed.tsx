import React, { FC } from 'react';

import { Frame, Modal } from '@react95/core';

import { FadeLoader } from 'react-spinners';

import { useEffect, useState, useRef } from 'react';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { LiveArbFeedProps } from './LiveArbFeed.type';
import { Shell323 } from '@react95/icons';

const height = 500;
const width = 780;
const maxArbsSize = 500;

const LiveArbFeedBody = () => {
  const showLoader = useRef(true);
  const [entries, setEntries] = useState<string[][]>([]);

  useEffect(() => {
    const client = new ReconnectingWebSocket('ws://72.52.83.236:8084');

    client.onmessage = function (e) {
      if (typeof e.data === 'string') {
        showLoader.current = false;
        const jsonObjectArr: Array<object> = JSON.parse(e.data);

        jsonObjectArr.forEach((jObject: object) => {
          const arraySize = 7;
          const defaultVal = '-';
          const newRow = Array(arraySize).fill(defaultVal);
          newRow[newRow.length - 1] = ((jObject['profit_potential'] - 1) * 100).toPrecision(5);

          let currentToken = 0;

          jObject['tokens'].forEach((token: string) => {
            newRow[currentToken] = token;
            currentToken++;
          });

          if (entries.length > maxArbsSize) {
            setEntries((prevEntries) => [newRow, ...prevEntries.slice(0, maxArbsSize - 1)]);
          } else {
            setEntries((prevEntries) => [newRow, ...prevEntries]);
          }
        });
      }
    };

    return () => {
      client.close();
    };
  }, []);

  return (
    <div>
      <Frame w={width} h={height}>
        <Frame h="100%" w="100%" boxShadow="in" bg="white">
          <div
            className={
              ' flex flex-col text-left  h-[100%] text-black pl-[0.1rem] ' +
              (entries.length > 15 ? 'overflow-y-scroll' : 'overflow-hidden')
            }>
            {!showLoader.current && (
              <table className=" flex flex-col table-fixed border-collapse  border-spacing-6  ">
                <tr className="flex justify-around items-center min-w-full bg-gray91">
                  <th className="flex  justify-center   w-[5.9rem] text-xs font-normal py-2 ">
                    Token 1
                  </th>
                  <th className="flex  justify-center  w-[5.9rem] text-xs font-normal py-2 ">
                    Token 2
                  </th>
                  <th className="flex  justify-center  w-[5.9rem] text-xs font-normal py-2 ">
                    Token 3
                  </th>
                  <th className="flex  justify-center  w-[5.9rem] text-xs font-normal py-2 ">
                    Token 4
                  </th>
                  <th className="flex  justify-center  w-[5.9rem] text-xs font-normal py-2 ">
                    Token 5
                  </th>
                  <th className="flex  justify-center  w-[5.9rem] text-xs font-normal py-2 ">
                    Token 6
                  </th>

                  <th className="     w-[5.9rem] text-xs font-normal  py-2 ">Profit margin (%)</th>
                </tr>
                {entries.map((entryData, index) => (
                  <tr
                    key={index}
                    className={
                      'flex justify-around min-w-full ' +
                      (index % 2 === 1 ? 'bg-arbxAltRowColor' : '')
                    }>
                    {entryData.map((item, index) => (
                      <th
                        className={
                          'flex  justify-center w-[5.9rem]  font-normal text-xs py-2    text-center  ' +
                          (index === entryData.length - 1 ? 'text-green-400' : 'text-blue-800')
                        }
                        key={index}>
                        {item}
                      </th>
                    ))}
                  </tr>
                ))}
              </table>
            )}

            {showLoader.current && (
              <div className="flex flex-col justify-center items-center h-full ">
                <FadeLoader color="#6f7573" loading={true} />
                <p>Looking up latest Arb Feed</p>
              </div>
            )}
          </div>
        </Frame>
      </Frame>
    </div>
  );
};

const LiveArbFeed: FC<LiveArbFeedProps> = ({ onClose }) => {
  return (
    <Modal
      width="797"
      height="540"
      icon={<Shell323 variant="32x32_4" />}
      title="Live Arb Feed"
      closeModal={onClose}>
      <LiveArbFeedBody />
    </Modal>
  );
};

export default LiveArbFeed;

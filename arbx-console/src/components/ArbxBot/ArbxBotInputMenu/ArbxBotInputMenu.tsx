import React from 'react';
import { FC } from 'react';
import { Modal, Frame } from '@react95/core';

import { Mailnews22 } from '@react95/icons';
import { ArbxBotInputMenuProps } from './ArbxBotInputMenu.type';

import BotInstanceInput from '../BotInstanceInput/BotInstanceInput';

const ArbxBotInputMenu: FC<ArbxBotInputMenuProps> = ({ onClose, nftDataArray, globalRpcUrl }) => {
  nftDataArray = [nftDataArray[0]]; // only allowing 1 instance at the moment
  return (
    <Modal
      height="660"
      width="770"
      icon={<Mailnews22 variant="32x32_4" />}
      closeModal={() => {
        onClose();
      }}
      title={'ArbX Bots'}>
      <Frame className="" h={620} w={755} boxShadow="in" bg="lightGrey">
        <div className="flex flex-col overflow-y-scroll scrollbar-hide w-full h-full gap-2 items-center py-1  ">
          {nftDataArray.length > 0 &&
            nftDataArray.map((nftData, index) => {
              return (
                <div key={index} className="my-2">
                  <BotInstanceInput nft={nftData} globalRpcUrl={globalRpcUrl} />
                </div>
              );
            })}
        </div>
      </Frame>
    </Modal>
  );
};

export default ArbxBotInputMenu;

import React from 'react';
import { FC } from 'react';
import { Coins95Props } from './Coins95.type';
import Coin95Body from './Coins95Body';
import { Modal } from '@react95/core';
import { D3Maze100 } from '@react95/icons';

const Coins95: FC<Coins95Props> = ({ onClose }) => {
  return (
    <Modal
      width="400"
      height="720"
      icon={<D3Maze100 variant="32x32_4" />}
      title="Market Watch"
      closeModal={onClose}>
      <Coin95Body />
    </Modal>
  );
};

export default Coins95;

import React from 'react';
import { FC } from 'react';
import { Modal, Frame } from '@react95/core';
import { Computer } from '@react95/icons';
import { SkiFreeProps } from './SkiFree.type';

const SkiFree: FC<SkiFreeProps> = ({ onClose }) => {
  return (
    <Modal
      height="660"
      width="770"
      icon={<Computer variant="32x32_4" />}
      closeModal={() => {
        onClose();
      }}
      title={'Ski Free'}>
      <Frame className="" h={620} w={755} boxShadow="in" bg="lightGrey"></Frame>
    </Modal>
  );
};

export default SkiFree;

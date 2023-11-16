import React from 'react';
import { FC } from 'react';
import { FolderProps } from './ArbXFolder.type';

const ArbxFolder: FC<FolderProps> = ({ name, onClick, icon }) => {
  return (
    <div className="flex flex-col items-center w-20 h-20 cursor-pointer" onClick={onClick}>
      <div>{icon}</div>
      <div className="text-center">{name}</div>
    </div>
  );
};

export default ArbxFolder;

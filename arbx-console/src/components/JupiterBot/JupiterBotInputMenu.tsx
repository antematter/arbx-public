import React from 'react';
import { FC } from 'react';

import { Checkbox, Button, Modal } from '@react95/core';
import { useEffect } from 'react';
import ArbxDropdown from '../ArbxDropDown/ArbxDropdown';
import { Keypair } from '@solana/web3.js';
import { decode } from 'bs58';
import {
  JupiterBotInputMenuProps,
  JupiterBotInputMenuBodyProps,
  userInputValues
} from './JupiterBot.type';

import { tokenOptionsforDeployment, ActionOptions } from '../../GlobalConstants';
import { Computer } from '@react95/icons';

const tokens = tokenOptionsforDeployment.map((tokenOption) => tokenOption[0]);
const tokenAddresses = tokenOptionsforDeployment.map((tokenOption) => tokenOption[1]);

const defaultTailwindColors = {
  amount: 'text-[#000000]',
  minProfit: 'text-[#000000]',
  slippage: 'text-[#000000]',
  Wallet: 'text-[#000000]'
};
const defaultErrorMessages = {
  amount: '',
  minProfit: '',
  slippage: '',
  Wallet: ''
};

const defaultUserValues: userInputValues = {
  token: tokens[0],
  tokenAddress: tokenAddresses[0],
  amount: 0.01,
  minProfit: 0.01,
  slippage: 0,
  privateKey: '',
  action: 'Buy'
};

const JupiterInputMenuBody: FC<JupiterBotInputMenuBodyProps> = ({
  displayJupiterBot,
  getUserInput
}) => {
  const [userValues, setUserValues] = React.useState(defaultUserValues);
  const [tailwindColors, setTailwindColors] = React.useState(defaultTailwindColors);
  const [slippageDefaultCheck, setSlippageDefaultCheck] = React.useState(true);
  const [errorMessages, setErrorMessages] = React.useState(defaultErrorMessages);

  useEffect(() => {
    const styleElem = document.head.appendChild(document.createElement('style'));
    styleElem.innerHTML = '#dopdownId:before {background: black; height: 50px; width: 50px;}';
  }, []);
  return (
    <div className="flex flex-col  justify-center items-center gap-6 mt-5">
      <div className={'flex items-start gap-2 text-black justify-between h-10 w-full px-5'}>
        <p>Token</p>

        <div className=" w-[60%]">
          <ArbxDropdown
            options={tokens}
            height="h-[2rem]"
            width="w-full"
            onChange={(value: string) => {
              setUserValues({
                ...userValues,
                token: value,
                tokenAddress: tokenAddresses[tokens.indexOf(value)]
              });
            }}
          />
        </div>
      </div>
      <div className={'flex items-start gap-2 text-black justify-between h-10 w-full px-5'}>
        <p>Action </p>

        <div className="w-[60%]">
          <ArbxDropdown
            options={ActionOptions}
            height="h-[2rem]"
            width="w-full "
            onChange={(value: string) => {
              setUserValues({
                ...userValues,
                action: value
              });
            }}
          />
        </div>
      </div>

      <div className={'flex items-start gap-2 text-black justify-between h-10 w-full px-5'}>
        <p>Min Profit </p>
        <div className="flex flex-col w-[60%]">
          <input
            className={
              ' flex bg-white border-1  border-2 border-t-[#2c2b2b] border-l-[#353434] rounded-none text-black ' +
              'w-full' +
              ' ' +
              'h-[2rem]'
            }
            type="number"
            value={userValues.minProfit}
            placeholder={'0.001'}
            onChange={(event) => {
              setUserValues({ ...userValues, minProfit: event.target.value as unknown as number });
            }}
          />
          <p className="text-red-500">{errorMessages.minProfit}</p>
        </div>
      </div>
      <div className={'flex items-start gap-2 text-black justify-between h-10 w-full px-5'}>
        <p>Amount </p>

        <div className="w-[60%]">
          <input
            className={
              ' flex bg-white border-1  border-2 border-t-[#2c2b2b] border-l-[#353434] rounded-none text-black ' +
              'w-full' +
              ' ' +
              'h-[2rem]'
            }
            type="number"
            value={userValues.amount}
            placeholder={'0.001'}
            onChange={(event) => {
              setUserValues({ ...userValues, amount: event.target.value as unknown as number });
            }}
          />
          <p className="text-red-500 overflow-wrap">{errorMessages.amount}</p>
        </div>
      </div>
      <div className={'flex items-start gap-2 text-black justify-between h-10 w-full px-5'}>
        <div className="flex flex-col gap-3">
          <p className="mt-1">Slippage </p>
          <div className="flex gap-2 items-center text-green-700 ">
            <p>profitOrKill</p>
            <Checkbox
              defaultChecked={slippageDefaultCheck}
              onChange={() => {
                if (!slippageDefaultCheck) {
                  setSlippageDefaultCheck(true);
                  setUserValues({ ...userValues, slippage: 'profitOrKill' });
                } else {
                  setSlippageDefaultCheck(false);
                  setUserValues({ ...userValues, slippage: 0.01 });
                }
              }}
            />
          </div>
        </div>

        <div className=" flex flex-col gap-1 w-[60%]">
          {slippageDefaultCheck && (
            <input
              className={
                ' flex bg-white border-1  border-2 border-t-[#2c2b2b] border-l-[#353434] rounded-none text-black ' +
                'w-full' +
                ' ' +
                'h-[2rem]'
              }
              value={'profitOrKill'}
              disabled={true}
            />
          )}
          {!slippageDefaultCheck && (
            <input
              className={
                ' flex bg-white border-1  border-2 border-t-[#2c2b2b] border-l-[#353434] rounded-none text-black ' +
                'w-full' +
                ' ' +
                'h-[2rem]'
              }
              type="number"
              value={userValues.slippage}
              placeholder={'0.001'}
              onChange={(event) => {
                setUserValues({ ...userValues, slippage: event.target.value as unknown as number });
              }}
            />
          )}
          <p className="text-red-500">{errorMessages.slippage}</p>
        </div>
      </div>
      <div className={'flex items-start gap-2 text-black justify-between h-10 w-full px-5'}>
        <p>Private Key </p>

        <div className=" flex flex-col gap-1 w-[60%]">
          <input
            className={
              ' flex bg-white border-1  border-2 border-t-[#2c2b2b] border-l-[#353434] rounded-none text-black ' +
              'w-full' +
              ' ' +
              'h-[2rem]'
            }
            value={userValues.privateKey}
            onChange={(event) => {
              setUserValues({ ...userValues, privateKey: event.target.value as unknown as string });
            }}
          />
          <p className="text-red-500">{errorMessages.Wallet}</p>
        </div>
      </div>
      <div className=" mt-0">
        <Button
          onClick={() => {
            const newTailwindColors = tailwindColors;
            const newErrorMessages = errorMessages;
            let correctTokenSyntax = true;
            //amount check (> 0)
            if (userValues.amount <= 0) {
              newErrorMessages.amount = 'Amount Should be greater than 0';
            } else {
              newErrorMessages.amount = '';
            }
            // min profit check (0 to 2)
            if (userValues.minProfit <= 0 || userValues.minProfit > 2) {
              newErrorMessages.minProfit = 'Profit should be in range (0 to 2)';
            } else {
              newErrorMessages.minProfit = '';
            }
            if (!slippageDefaultCheck && userValues.slippage <= 0) {
              newErrorMessages.slippage = 'Slippage should be greater than 0';
            } else {
              newErrorMessages.slippage = '';
            }
            // wallet key check
            try {
              Keypair.fromSecretKey(decode(userValues.privateKey));
              errorMessages.Wallet = '';
            } catch (error) {
              errorMessages.Wallet = 'Invalid private key entered';
              correctTokenSyntax = false;
            }
            setErrorMessages(newErrorMessages);
            setTailwindColors({ ...newTailwindColors });

            if (
              userValues.amount > 0 &&
              userValues.minProfit > 0 &&
              userValues.minProfit <= 2 &&
              (slippageDefaultCheck || userValues.slippage > 0) && // check if slippage is greater then zero when not default
              correctTokenSyntax
            ) {
              displayJupiterBot();
              getUserInput(userValues);
            }
          }}>
          Enter
        </Button>
      </div>
    </div>
  );
};

const JupiterInputMenu: FC<JupiterBotInputMenuProps> = ({
  onClose,
  displayJupiterBot,
  getUserInput
}) => {
  return (
    <Modal
      width="470"
      height="480"
      icon={<Computer variant="32x32_4" />}
      title="Jupiter Input Menu"
      closeModal={onClose}>
      <JupiterInputMenuBody displayJupiterBot={displayJupiterBot} getUserInput={getUserInput} />
    </Modal>
  );
};

export default JupiterInputMenu;

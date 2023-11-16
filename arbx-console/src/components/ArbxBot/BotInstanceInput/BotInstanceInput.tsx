import React from 'react';
import { Frame } from '@react95/core';
import ReconnectingWebSocket from 'reconnecting-websocket';
import ArbxDropdown from '../../ArbxDropDown/ArbxDropdown';
import { ErrorMessages, UserInputValues } from './BotInstanceInput.type';
import { tokenOptionsforDeployment } from '../../../GlobalConstants';
import ArbxButton from '../../ArbxButton/ArbxButton';
import { FC } from 'react';
import { BotInstanceInputProps } from './BotInstanceInput.type';
import { writeTextFile, BaseDirectory, exists, createDir } from '@tauri-apps/api/fs';
import { Child, Command } from '@tauri-apps/api/shell';
import { Keypair } from '@solana/web3.js';
import { decode } from 'bs58';
import { cacheDir } from '@tauri-apps/api/path';

const tokens = tokenOptionsforDeployment.map((tokenOption) => tokenOption[0]);

const ERROR_OCCURED_MESSAGES: ErrorMessages = {
  inputAmount: 'Amount should be greater than five.',
  slippage: 'Slippage should be greater than or equal to one.',
  privateKey: 'Invalid private key was provided.'
};

const DEFAULT_ERROR_MESSAGES: ErrorMessages = {
  inputAmount: '',
  slippage: '',
  privateKey: ''
};

const DEFAULT_USER_VALUES: UserInputValues = {
  targetToken: tokens[0],
  inputAmount: 5,
  slippage: 1,
  privateKey: '',
  rpcUrl: ''
};

const BotInstanceInput: FC<BotInstanceInputProps> = ({ nft, globalRpcUrl }) => {
  let executionEngineSpawning = false;
  const [userValues, setUserValues] = React.useState(DEFAULT_USER_VALUES);
  const [errorMessages, setErrorMessages] = React.useState(DEFAULT_ERROR_MESSAGES);
  const [executionEngineInstance, setExecutionEngineInstance] = React.useState<Child | null>(null);
  const [startFocused, setStartFocused] = React.useState(false);
  const [stopFocused, setStopFocused] = React.useState(false);
  const [arbxEngineLogs, setarbxEngineLogs] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (executionEngineInstance !== null) {
      console.log('new bot instance started');
      const client = new ReconnectingWebSocket('ws://localhost:44000');

      client.onmessage = function (e) {
        if (typeof e.data === 'string') {
          setarbxEngineLogs((botLogs) => [e.data, ...botLogs]);
        }
      };

      return () => {
        setarbxEngineLogs([]);
        console.log('bot instance stopped');
        if (executionEngineInstance) {
          // this will kill bot instance when user closes the modal
          executionEngineInstance.kill();
          console.log('killed bot instance');
        }

        client.close();
      };
    }
  }, [executionEngineInstance]);

  const runArbxExecutionEngine = async (userValues: UserInputValues) => {
    if (executionEngineSpawning) return;
    executionEngineSpawning = true;

    try {
      const cacheDirExists = (await exists('arbx/', {
        ////
        dir: BaseDirectory.Cache
      })) as unknown as boolean;
      if (!cacheDirExists) await createDir('arbx/', { dir: BaseDirectory.Cache });

      const confFileName = `arbx/bot-conf-${Math.floor(Math.random() * 1e16)}.json`;
      await writeTextFile(confFileName, JSON.stringify(userValues), {
        dir: BaseDirectory.Cache
      });

      const executionEngine = Command.sidecar(
        'execution-engine/execution-engine',
        `${await cacheDir()}${confFileName}`,
        { env: { NODE_ENV: 'production' } }
      );
      setExecutionEngineInstance(await executionEngine.spawn());
    } catch {
      executionEngineSpawning = false;
    }
  };

  const checkuserInputAndUpdateErrorMessages = (
    userValues: UserInputValues,
    setErrorMessages: React.Dispatch<React.SetStateAction<ErrorMessages>>
  ): boolean => {
    const newErrorMessages: ErrorMessages = { ...DEFAULT_ERROR_MESSAGES };
    let correctTokenSyntax = true;

    if (userValues.inputAmount < 5) {
      newErrorMessages.inputAmount = ERROR_OCCURED_MESSAGES.inputAmount;
      correctTokenSyntax = false;
    } else {
      newErrorMessages.inputAmount = DEFAULT_ERROR_MESSAGES.inputAmount;
    }

    if (userValues.slippage < 1) {
      newErrorMessages.slippage = ERROR_OCCURED_MESSAGES.slippage;
      correctTokenSyntax = false;
    } else {
      newErrorMessages.slippage = DEFAULT_ERROR_MESSAGES.slippage;
    }

    try {
      Keypair.fromSecretKey(decode(userValues.privateKey));
      newErrorMessages.privateKey = DEFAULT_ERROR_MESSAGES.privateKey;
    } catch (error) {
      newErrorMessages.privateKey = ERROR_OCCURED_MESSAGES.privateKey;
      correctTokenSyntax = false;
    }

    setErrorMessages(newErrorMessages);
    if (correctTokenSyntax) {
      return true;
    } else {
      return false;
    }
  };

  return (
    <Frame w={750} h={400} padding={2}>
      <div className="flex h-full justify-between gap-x-4 p-4">
        <img className="w-[30%] max-h-full" src={nft.image} alt="logo" />
        <div className="flex w-[70%] h-full flex-col justify-between">
          {!executionEngineInstance ? (
            <div className="flex flex-col h-[80%] gap-y-2 grow">
              <div className="flex items-start justify-between text-black gap-3 w-full">
                <p>Private Key </p>
                <div className="flex flex-col gap-1 h-[3.5rem] w-[80%]">
                  <input
                    className={
                      ' flex bg-white border-1  border-2 border-t-[#2c2b2b] border-l-[#353434] rounded-none text-black ' +
                      'w-full' +
                      ' ' +
                      'h-[2rem]'
                    }
                    type="text"
                    value={userValues.privateKey}
                    onChange={(event) => {
                      setUserValues({
                        ...userValues,
                        privateKey: event.target.value as unknown as string
                      });
                    }}
                  />
                  <p className="text-red-500">{errorMessages.privateKey}</p>
                </div>
              </div>
              <div className={'flex items-start justify-between  text-black gap-3  w-full'}>
                <p>Amount</p>
                <div className="flex flex-col h-[3.5rem] w-[80%]">
                  <input
                    className={
                      ' flex bg-white border-1  border-2 border-t-[#2c2b2b] border-l-[#353434] rounded-none text-black ' +
                      'w-full' +
                      ' ' +
                      'h-[2rem]'
                    }
                    type="number"
                    value={userValues.inputAmount}
                    placeholder={'5'}
                    onChange={(event) => {
                      setUserValues({
                        ...userValues,
                        inputAmount: parseInt(event.target.value)
                      });
                    }}
                  />
                  <p className="text-red-500">{errorMessages.inputAmount}</p>
                </div>
              </div>
              <div className={'flex items-start justify-between  text-black gap-3  w-full'}>
                <p>Slippage </p>
                <div className=" flex flex-col h-[3.5rem] w-[80%]">
                  <input
                    className={
                      ' flex bg-white border-1  border-2 border-t-[#2c2b2b] border-l-[#353434] rounded-none text-black ' +
                      'w-full' +
                      ' ' +
                      'h-[2rem]'
                    }
                    type="number"
                    value={userValues.slippage}
                    placeholder={'1'}
                    onChange={(event) => {
                      setUserValues({
                        ...userValues,
                        slippage: parseInt(event.target.value)
                      });
                    }}
                  />
                  <p className="text-red-500">{errorMessages.slippage}</p>
                </div>
              </div>
              <div className={'flex items-center justify-between  text-black gap-3  w-full'}>
                <p>Token </p>
                <div className="w-[80%]">
                  <ArbxDropdown
                    options={tokens}
                    height="h-[2rem]"
                    width="w-full"
                    onChange={(value: string) => {
                      setUserValues({
                        ...userValues,
                        targetToken: value
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-between   shadow-arbxBotInstance   h-[80%] bg-white">
              <div className="flex flex-col overflow-y-scroll scrollbar-hide">
                {arbxEngineLogs.map((message, index) => (
                  <p
                    key={index}
                    className={
                      (index % 2 === 1 ? 'bg-arbxAltRowColor' : '') +
                      ' text-blue-800 px-1' +
                      ' py-2  break-words  '
                    }>
                    {message}
                  </p>
                ))}
              </div>
              <div className="flex bg-[#E8E8E8] justify-end items-center gap-1 pr-3">
                <p className="text-black">Status:</p>
                <p className="text-blue-800">running</p>
              </div>
            </div>
          )}
          <div
            className="flex  justify-end gap-2
             items-center mt-3">
            <ArbxButton
              focused={startFocused}
              textColor="green"
              onClick={() => {
                if (checkuserInputAndUpdateErrorMessages(userValues, setErrorMessages)) {
                  setUserValues({
                    ...userValues,
                    rpcUrl: globalRpcUrl
                  });
                  setStartFocused(true);
                  setStopFocused(false);
                  runArbxExecutionEngine(userValues);
                }
              }}
              text="Start"
            />
            <ArbxButton
              focused={stopFocused}
              textColor="red"
              onClick={() => {
                if (executionEngineInstance) {
                  setStartFocused(false);
                  setStopFocused(true);
                  executionEngineInstance.kill();
                  setExecutionEngineInstance(null);
                }
              }}
              text="Stop"
            />
          </div>
        </div>
      </div>
    </Frame>
  );
};

export default BotInstanceInput;

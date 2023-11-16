import { NFTData } from '../../Arbx/Arbx.type';

export interface BotInstanceInputProps {
  nft: NFTData;
  globalRpcUrl: string;
}

export interface UserInputValues {
  targetToken: string;
  inputAmount: number;
  slippage: number;
  privateKey: string;
  rpcUrl: string;
}

export interface ErrorMessages {
  privateKey: string;
  inputAmount: string;
  slippage: string;
}

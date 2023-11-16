import { NFTData } from '../Arbx/Arbx.type';

export interface LoginBoxProps {
  setNftsCount: React.Dispatch<React.SetStateAction<number>>;
  setNftDataArray: React.Dispatch<React.SetStateAction<NFTData[]>>;
  setGlobalRpcUrl: React.Dispatch<React.SetStateAction<string>>;
}

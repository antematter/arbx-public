import { NFTData } from '../../Arbx/Arbx.type';

export interface ArbxBotInputMenuProps {
  onClose: () => void;
  nftDataArray: NFTData[];
  globalRpcUrl: string;
}

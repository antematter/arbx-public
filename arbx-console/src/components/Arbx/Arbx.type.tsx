import { PublicKey } from '@metaplex-foundation/js';

export interface ArbxProps {
  nftDataArray: NFTData[];
  globalRpcUrl: string;
  onLogout: () => void;
}

export interface NFTData {
  image: string;
  mint: PublicKey;
}

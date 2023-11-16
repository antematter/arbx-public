export interface userInputValues {
  token: string;
  tokenAddress: string;
  amount: number;
  minProfit: number;
  slippage: string | number;
  privateKey: string;
  action: string;
}

export interface JupiterBotInputMenuProps {
  onClose: () => void;
  displayJupiterBot: () => void;
  getUserInput: (data: userInputValues) => void;
}

export interface JupiterBotInputMenuBodyProps {
  displayJupiterBot: () => void;
  getUserInput: (data: userInputValues) => void;
}

export interface JupiterBotFeedBodyProps {
  inputData: userInputValues;
}

export interface JupiterBotFeedProps {
  onClose: () => void;
  inputData: userInputValues;
}

export interface JupiterBotTokenDetails {
  currentBalance: string;
  lastBalance: string;
  initialBalance: string;
}

export interface JupiterBotOutput {
  started: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timestamp: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tradingToken: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lookupLatency: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  minInterval: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queueStatus: string;
  routes: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  strategy: any;
  statusMessage: string;
  totalSuccessfulBuys: number;
  totalSuccessfulSells: number;
  totalFailedBuys: number;
  totalFailedSells: number;
  profit: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slippage: any;
  latestInAmount: string;
  latestOutAmount: string;
  profitData: number[];
  maxBuy: string;
  maxSell: string;
  tokenADetails: JupiterBotTokenDetails;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tradeHistory: any[];
}

import chalk from 'chalk';


export function getBothPossibleTokenPairs(
  firstToken: string,
  secondToken: string
): [string, string] {
  return [`${firstToken}-${secondToken}`, `${secondToken}-${firstToken}`];
}

export function getSolscanLink(txID: string): string {
  return (`${chalk.underline(`https://solscan.io/tx/${txID}`)}`);
}

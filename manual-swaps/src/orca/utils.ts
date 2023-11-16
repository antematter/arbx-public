import { logger } from "../../utils/logger";
import { ORCA_POOL_CONFIGS } from "./pools";
import { getOrca, OrcaPool } from "@orca-so/sdk";
import { DexException } from "../../utils/types";
import { TransactionPayload } from "@orca-so/sdk/dist/public/utils"
import { CONNECTION, ORCA_PREFIX, RETRY_LIMIT } from "../../utils/constants";
import { getBothPossibleTokenPairs, getSolscanLink } from "../../utils/helpers";


export function getPool(
  firstTokenPair: string,
  secondTokenPair: string
): OrcaPool {

  const poolConfig =
    ORCA_POOL_CONFIGS.get(firstTokenPair) ??
    ORCA_POOL_CONFIGS.get(secondTokenPair);

  if (!poolConfig) {
    throw new Error(
      `${ORCA_PREFIX} Pool config for tokens ${firstTokenPair.split(
        "-"
      )} could not be retrieved!`
    );
  }
  const orca = getOrca(CONNECTION); 
  return orca.getPool(poolConfig);
}


export function isStablePool(firstToken: string, secondToken: string): boolean {
  const stableOrcaPools = [
    "USDC-USDT",
    "USDT-USDC",
    "MSOL-SOL",
    "SCNSOL-SOL",
    "WUST-USDC",
    "STSOL-SOL",
  ];
  const [firstPair, secondPair] = getBothPossibleTokenPairs(
    firstToken,
    secondToken
  );
  return stableOrcaPools.some((pool) => firstPair === pool || secondPair === pool);
}

export async function executeTransaction(payload: TransactionPayload): Promise<void> {
  let txRetry = 0;
  while (++txRetry <= RETRY_LIMIT) {
    try {
      const txSignature = await payload.execute();
      logger.info(
        `${ORCA_PREFIX} Swap successful: ${getSolscanLink(txSignature)}`
      );
      break;
    } 
    catch (err) {
      if (txRetry === RETRY_LIMIT) {
        const dexError = err as DexException;
        if (dexError.logs) {
          throw new Error(
            `${ORCA_PREFIX} Transaction execution failed: ${dexError.logs.join(
              "\n"
            )}`
          );
        } else {
          throw new Error(
            `${ORCA_PREFIX} Transaction execution failed: ${dexError}`
          );
        }
      }
    }
  }
}
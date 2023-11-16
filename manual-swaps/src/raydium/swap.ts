import { SwapParams } from "../../utils/types";
import { getPoolKeys, swap } from "./utils";
import { RAY_LIQUIDITY_POOLS } from "./pools";
import { getBothPossibleTokenPairs } from "../../utils/helpers";
import { CONNECTION, OWNER, RAY_PREFIX, SLIPPAGE } from "../../utils/constants";


export async function swapOnRaydium(swapParams: SwapParams): Promise<number> {
  const [firstPossibleTokenPair, secondPossibleTokenPair] =
    getBothPossibleTokenPairs(swapParams.firstToken, swapParams.secondToken);

  const poolAddress =
    RAY_LIQUIDITY_POOLS.get(firstPossibleTokenPair) ??
    RAY_LIQUIDITY_POOLS.get(secondPossibleTokenPair);

  if (!poolAddress) {
    throw new Error(
      `${RAY_PREFIX} Pool address for tokens ${firstPossibleTokenPair.split(
        "-"
      )} could not be retrieved!`
    );
  }
  const poolKeys = await getPoolKeys(poolAddress);
  const expectedOutputAmount = await swap(
    CONNECTION,
    poolKeys,
    OWNER,
    swapParams.swapAmount,
    SLIPPAGE,
    swapParams.buySide
  );

  return Number(expectedOutputAmount);
}
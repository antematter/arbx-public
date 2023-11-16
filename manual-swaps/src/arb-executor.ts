import { swapOnOrca } from "./orca"
import { swapOnRaydium } from "./raydium"
import { Dex, ArbLegParams, BuySide } from "../utils/types";


export class ArbitrageExecutor {
  allArbitrages: ArbLegParams[] = [];

  enqueueNewFirstLeg(): void {
    if (this.allArbitrages.length === 0) {
      return;
    }
    const firstArbLeg = this.allArbitrages[0];
    if (
      firstArbLeg.buySide === BuySide.Base ||
      (firstArbLeg.buySide === BuySide.Quote &&
        firstArbLeg.firstToken !== "USDC" &&
        firstArbLeg.firstToken !== "USDT")
    ) {
      this.allArbitrages.unshift({
        firstToken: "USDC",
        secondToken: firstArbLeg.firstToken,
        dex: firstArbLeg.dex,
        buySide: BuySide.Quote,
      });
    } 
  }

  queueArbitrageLeg(arbitrage: ArbLegParams): ArbitrageExecutor {
    this.allArbitrages.push(arbitrage);
    return this;
  }

  clearArbs(): void {
    this.allArbitrages = [];
  }

  async execute(startingAmount: number, addFirstLeg: boolean = false): Promise<void> {
    if (addFirstLeg) {
      this.enqueueNewFirstLeg();
    }
    let swapAmount = startingAmount;

    for (const arbitrage of this.allArbitrages) {
      if (arbitrage.dex === Dex.Orca) {
        swapAmount = await swapOnOrca({
          ...arbitrage,
          swapAmount,
        });
      } 
      else if (arbitrage.dex === Dex.Raydium) {
        swapAmount = await swapOnRaydium({
          ...arbitrage,
          swapAmount,
        });
      }
    }
  }
}

import * as log4js from "log4js";
const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
import {ISwapRoutes} from "../interfaces";

export abstract class Strategy {

  private name:string;

  constructor(name: string) {
    this.name = name;
  }

  public display():void {
      flog.debug(`Strategy.display: name:${this.name};`);
  }

  getWinningPairStr(aSwapPair:ISwapRoutes) {
    let fromTokenSymbol = aSwapPair.swapPairRoutes[0].fromToken.symbol;
    let toTokenSymbol = aSwapPair.swapPairRoutes[0].toToken.symbol;
    let firstBestRouteIdx = aSwapPair.idxBestRouterToAmountList[0];
    let firstBestRouterName= aSwapPair.swapPairRoutes[0].routerToAmountList[firstBestRouteIdx].router.name;
    let firstBestRouterRate = aSwapPair.swapPairRoutes[0].routerToAmountList[firstBestRouteIdx].toFromRate;
    let secondBestRouteIdx = aSwapPair.idxBestRouterToAmountList[1];
    let secondBestRouterName= aSwapPair.swapPairRoutes[1].routerToAmountList[secondBestRouteIdx].router.name;
    let secondBestRouterRate = aSwapPair.swapPairRoutes[1].routerToAmountList[secondBestRouteIdx].toFromRate;
    let finalRate = firstBestRouterRate * secondBestRouterRate;

    return [fromTokenSymbol, firstBestRouterName, toTokenSymbol, firstBestRouterRate, secondBestRouterName, secondBestRouterRate, finalRate] as const;
  }

  public abstract refreshAll():void;

  public abstract refresh(idx:number):void;

  public abstract initTwoSwapsArray(aSwapPairList:ISwapRoutes[]):void;
  //public abstract addSwapPair(aFromSwap:ISwapPairRoutes, aToSwap:ISwapPairRoutes, fromSwapFromAmount:BigNumber):void;

  public abstract printSwapPair(idx:number):void;
}

export namespace Strategy {
  export enum MODE {SERIAL, PARALLEL_V1, PARALLEL_V2}
}
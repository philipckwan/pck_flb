import { BigNumber } from "ethers";

export interface IToken {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  amountForSwap: number;
  }

export interface IRouter {
  name: string;
  address: string;
  protocol: number;
}

export interface IRouterToAmount {
  idx:number;
  router: IRouter;
  toFromRate: number;
}

export interface ITwoSwaps {
  fromSwap:ISwapPairRoutes;
  toSwap:ISwapPairRoutes;
  fromWinnerIdx:number;
  toWinnerIdx:number;
}
export interface ISwapPairRoutes {
  fromToken: IToken;
  fromAmount: BigNumber;
  toToken: IToken;
  routerToAmountList: IRouterToAmount[];
}

export interface ISwapRoutes {
  swapPairRoutes: ISwapPairRoutes[];
  idxBestRouterToAmountList: number[];
}

export interface IToRate {
  /*
    it's a results object used mainly between strategy and price modules
  */
  toFromRate:number;
  routerIdx:number;
  router:IRouter;
  isFrom:boolean;
}

export interface ISwap {
  protocol: number;
  part: number;
  data: string;
}

export interface IHop {
  swaps: ISwap[];
  path: string[];
}

export interface IFlashloanRoute {
  hops: IHop[];
  part: number;
}

export interface IParams {
  flashLoanPool: string;
  loanAmount: BigNumber;
  firstRoutes: IFlashloanRoute[];
  secondRoutes: IFlashloanRoute[];
}

export interface ItfTrade {
  /*
    a trade is similar to a IFlashloanRoute
    that is, it consists of two or more hops (ItfHop)
    it is passed as a whole to call the flashloan contract
   */
  hops: ItfHop[];
}

export interface ItfHop {
  // a hop is similar to a ISwap
  // that is, it consists of a pair of tokens: tokenFrom and tokenTo
  // along with the swap router (address), so that the flashloan contract knows how to swap it
  tokenFrom: IToken;
  tokenTo: IToken;
  swapRouter: IRouter;
  maxRate: number;
}

export interface ItfFlashloanV2Hop {
  protocol: number;
  data: string;
  path: string[];
}

export interface ItfFlashloanV2Route {
  hops: ItfFlashloanV2Hop[];
  part: number;
}

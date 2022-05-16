import { BigNumber } from "ethers";

export interface IToken {
    symbol: string;
    name: string;
    decimals: number;
    address: string;
  }

export interface IRouter {
    name: string;
    address: string;
}

export interface IRouterToAmount {
    router: IRouter;
    toAmount: BigNumber;
    toFromRate: number;
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

export interface IToAmountAndRate {
  toAmount:BigNumber;
  toFromRate:number;
}
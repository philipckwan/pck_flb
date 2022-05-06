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

export interface ISwapPairRoutes {
    fromToken: IToken;
    fromAmount: BigNumber;
    toToken: IToken;
    routeToAmounts: {
      router: IRouter;
      toAmount: BigNumber;
    }[]
}

export interface ISwapRoutes {
  swapPairRoutes: ISwapPairRoutes[];
}
import {getBigNumber} from "../utility"
import { BigNumber, ethers } from "ethers";
import * as UniswapV2Router from "../abis/IUniswapV2Router02.json";
import {PCKWeb3Handler} from "../utils/Web3Handler";

import * as log4js from "log4js";
const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");

export const getPriceOnUniV2 = async (
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber,
    routerAddress: string
    ): Promise<BigNumber> => {
    let v2Router = new ethers.Contract(
        routerAddress,
        UniswapV2Router.abi,
        PCKWeb3Handler.web3Provider
    );
    const amountsOut = await v2Router.getAmountsOut(amountIn, [
      tokenIn,
      tokenOut,
    ]);
    if (!amountsOut || amountsOut.length !== 2) {
      return getBigNumber(0);
    }
    return amountsOut[1];
  };
  
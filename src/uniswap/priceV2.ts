import {getBigNumber, web3Provider} from "../utility"
import { BigNumber, ethers } from "ethers";
import * as UniswapV2Router from "../abis/IUniswapV2Router02.json";

import * as log4js from "log4js";
const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");

export const getPriceOnUniV2 = async (
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber,
    routerAddress: string
    ): Promise<BigNumber> => {
    //clog.debug(`priceV2.getPriceOnUniV2: 1.0;`);
    let v2Router = new ethers.Contract(
        routerAddress,
        UniswapV2Router.abi,
        web3Provider
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
  
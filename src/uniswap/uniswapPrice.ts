/* This file is obsoleted */

/*
import {getSwapsStrings, getBigNumber, formatDate} from "../utility";
import {IToken, IRouter, IToRate, ISwapRoutes, ItfHop} from "../interfaces";
import * as log4js from "log4js";
import {PCKPriceV3} from "./priceV3";
import {getPriceOnUniV2} from "./priceV2";
import {BigNumber, ethers} from "ethers";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
const slog = log4js.getLogger("statsFile");

export const getSwapRateByHop = async (hop:ItfHop, router:IRouter):Promise<[ItfHop, IToRate]> => {
    let resultToRate:IToRate = await getSwapRate(hop.tokenFrom, hop.tokenTo, router);
    return [hop, resultToRate];
}

export const getSwapRate = async (fromToken : IToken, toToken : IToken, router : IRouter, aRouterIdx = 0, aIsFrom = true) : Promise<IToRate> => {
    //let bnFromAmount = getBigNumber(fromAmount, fromToken.decimals);
    let resultToAmountAndRate:IToRate = {toFromRate:0, routerIdx:aRouterIdx, isFrom:aIsFrom, router:router};
    let bnToAmount = getBigNumber(0);
    let startTime = Date.now();
    let bnFromAmount = ethers.utils.parseUnits(fromToken.amountForSwap.toString(), fromToken.decimals); 
    //clog.debug(`utility.getSwapRate: ${fromToken.symbol} -> ${toToken.symbol} @ [${router.name}]; from$${fromAmount}`);
    try {
        if (router.name == "POLYGON_UNISWAP_V3") {
            let fee = PCKPriceV3.getFeeOnUniV3(fromToken.symbol, toToken.symbol);
            //clog.debug(`_fee:${fee};`);
            bnToAmount = await PCKPriceV3.getPriceOnUniV3(fromToken.address, toToken.address, bnFromAmount, fee);
        } else {
            bnToAmount = await getPriceOnUniV2(fromToken.address, toToken.address, bnFromAmount, router.address);
        }
    } catch (ex) {
        clog.error(`uniswapPrice.getSwapRate: ERROR;`)
        flog.error(`uniswapPrice.getSwapRate: ERROR;`);
        flog.error(ex);
    }
    let endTime = Date.now();
    let timeDiff = (endTime - startTime) / 1000;
    let nToAmount = Number(ethers.utils.formatUnits(bnToAmount,toToken.decimals));
    let nFromAmount = Number(ethers.utils.formatUnits(bnFromAmount,fromToken.decimals));
    resultToAmountAndRate.toFromRate = nToAmount / nFromAmount;
    //clog.debug(`__toFromRate:${resultToAmountAndRate.toFromRate}; router:${router.name};`);
    slog.debug(`${fromToken.symbol.padStart(6)}|${toToken.symbol.padStart(6)}|${router.name.padStart(18)}|${resultToAmountAndRate.toFromRate.toFixed(7).padStart(14)}|${formatDate(startTime)}|${formatDate(endTime)}|${timeDiff.toFixed(3)}`);
    return resultToAmountAndRate;
};
*/
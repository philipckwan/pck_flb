import {getBigNumber, formatDate} from "../utility";
import {IToken, IRouter, IToAmountAndRate, ISwapRoutes} from "../interfaces";
import * as log4js from "log4js";
import {getFeeOnUniV3, getPriceOnUniV3} from "./priceV3";
import {getPriceOnUniV2} from "./priceV2";
import {BigNumber, ethers} from "ethers";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
const slog = log4js.getLogger("statsFile");

export const processSwapRoutes = async (swapRoutes : ISwapRoutes) : Promise<ISwapRoutes> => {
    clog.debug(`utility.processSwapRoutes: 1.0;`);
    return swapRoutes;
}

export const getSwapAmountAndRate = async (fromToken : IToken, toToken : IToken, router : IRouter, fromAmount = getBigNumber(1)) : Promise<IToAmountAndRate> => {
    //let bnFromAmount = getBigNumber(fromAmount, fromToken.decimals);
    let resultToAmountAndRate:IToAmountAndRate = {toAmount:getBigNumber(0),toFromRate:0};
    //let bnToAmount = getBigNumber(0);
    let startTime = Date.now();
    clog.debug(`utility.getSwapPriceRate: ${fromToken.symbol} -> ${toToken.symbol} @ [${router.name}]; from$${fromAmount}`);
    try {
        if (router.name == "POLYGON_UNISWAP_V3") {
            //clog.debug(`utility.getSwapPrice: calling getFeeOnUniV3;`);
            let fee = getFeeOnUniV3(fromToken.symbol, toToken.symbol);
            //clog.debug(`_fee:${fee};`);
            resultToAmountAndRate.toAmount = await getPriceOnUniV3(fromToken.address, toToken.address, fromAmount, fee);
        } else {
            //clog.debug(`utility.getSwapPrice: calling getPriceOnUniV2;`);
            resultToAmountAndRate.toAmount = await getPriceOnUniV2(fromToken.address, toToken.address, fromAmount, router.address);
        }
    } catch (ex) {
        clog.error(`uniswapPrice.getSwapAmountAndRate: ERROR;`)
        flog.error(`uniswapPrice.getSwapAmountAndRate: ERROR;`);
        flog.error(ex);
    }
    let endTime = Date.now();
    let timeDiff = (endTime - startTime) / 1000;
    let nToAmount = Number(ethers.utils.formatUnits(resultToAmountAndRate.toAmount,toToken.decimals));
    let nFromAmount = Number(ethers.utils.formatUnits(fromAmount,fromToken.decimals));
    //let nFromAmount = 1;
    resultToAmountAndRate.toFromRate = nToAmount / nFromAmount;
    clog.debug(`__toFromRate:${resultToAmountAndRate.toFromRate}; router:${router.name};`);
    slog.debug(`${fromToken.symbol.padStart(6)}|${toToken.symbol.padStart(6)}|${router.name.padStart(18)}|${resultToAmountAndRate.toFromRate.toFixed(9)}|${formatDate(startTime)}|${formatDate(endTime)}|${timeDiff.toFixed(3)}`);
    return resultToAmountAndRate;
};

/*
export const getSwapPrice = async (fromToken : IToken, toToken : IToken, router : IRouter, fromAmount:BigNumber = getBigNumber(10000)) => {
    //let bnFromAmount = fromAmount;
    let bnToAmount = getBigNumber(0);
    let startTime = Date.now();
    let fromAmountStr = ethers.utils.formatUnits(fromAmount,fromToken.decimals);
    //clog.debug(`utility.getSwapPrice: ${fromToken.symbol} -> ${toToken.symbol} @ [${router.name}(${router.address})] for [${fromAmount}]/bn:[${bnFromAmount}];`);
    clog.debug(`utility.getSwapPrice: ${fromToken.symbol} -> ${toToken.symbol} @ [${router.name}] for $${fromAmountStr};`);
    if (router.name == "POLYGON_UNISWAP_V3") {
        //clog.debug(`utility.getSwapPrice: calling getFeeOnUniV3;`);
        let fee = getFeeOnUniV3(fromToken.symbol, toToken.symbol);
        //clog.debug(`_fee:${fee};`);
        bnToAmount = await getPriceOnUniV3(fromToken.address, toToken.address, fromAmount, fee);
    } else {
        //clog.debug(`utility.getSwapPrice: calling getPriceOnUniV2;`);
        bnToAmount = await getPriceOnUniV2(fromToken.address, toToken.address, fromAmount, router.address);
    }
    let endTime = Date.now();
    let timeDiff = (endTime - startTime) / 1000;
    //let bDate = formatDate(startTime);
    let bnToAmountStr = bnToAmount.toString();
    let bnToAmountStrLen = bnToAmountStr.length;
    let bnToAmountHeadStr = bnToAmountStr.substring(0,bnToAmountStrLen - toToken.decimals);
    let bnToAmountTailStr = bnToAmountStr.substring(bnToAmountStrLen - toToken.decimals);
    //clog.debug(`__bnToAmountStr:${bnToAmountStr};bnToAmountStrLen:${bnToAmountStrLen};bnToAmountHeadStr:${bnToAmountHeadStr};bnToAmountTailStr:${bnToAmountTailStr};`);
    slog.debug(`${fromToken.symbol.padStart(6)}|${toToken.symbol.padStart(6)}|${router.name.padStart(18)}|${bnToAmountHeadStr.padStart(5)}|${bnToAmountTailStr.padStart(19)}|${formatDate(startTime)}|${formatDate(endTime)}|${timeDiff.toFixed(3)}`);
    return bnToAmount;
};
*/
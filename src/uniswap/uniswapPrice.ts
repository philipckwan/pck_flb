import {getBigNumber, formatDate} from "../utility";
import { IToken, IRouter } from "../interfaces";
import * as log4js from "log4js";
import {getFeeOnUniV3, getPriceOnUniV3} from "./priceV3";
import {getPriceOnUniV2} from "./priceV2";
import {BigNumber} from "ethers";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
const slog = log4js.getLogger("statsFile");


export const getSwapPrice = async (fromToken : IToken, toToken : IToken, router : IRouter, fromAmount:BigNumber = getBigNumber(10000)) => {
    let bnFromAmount = fromAmount;
    let bnToAmount = getBigNumber(0);
    let startTime = Date.now();
    clog.debug(`utility.getSwapPrice: ${fromToken.symbol} -> ${toToken.symbol} @ [${router.name}(${router.address})] for [${fromAmount}]/bn:[${bnFromAmount}];`);
    if (router.name == "POLYGON_UNISWAP_V3") {
        //clog.debug(`utility.getSwapPrice: calling getFeeOnUniV3;`);
        let fee = getFeeOnUniV3(fromToken.symbol, toToken.symbol);
        //clog.debug(`_fee:${fee};`);
        bnToAmount = await getPriceOnUniV3(fromToken.address, toToken.address, bnFromAmount, fee);
    } else {
        //clog.debug(`utility.getSwapPrice: calling getPriceOnUniV2;`);
        bnToAmount = await getPriceOnUniV2(fromToken.address, toToken.address, bnFromAmount, router.address);
    }
    let endTime = Date.now();
    let timeDiff = (endTime - startTime) / 1000;
    //let bDate = formatDate(startTime);
    let bnToAmountStr = bnToAmount.toString();
    let bnToAmountStrLen = bnToAmountStr.length;
    let bnToAmountHeadStr = bnToAmountStr.substring(0,bnToAmountStrLen - toToken.decimals);
    let bnToAmountTailStr = bnToAmountStr.substring(bnToAmountStrLen - toToken.decimals);
    clog.debug(`__bnToAmountStr:${bnToAmountStr};bnToAmountStrLen:${bnToAmountStrLen};bnToAmountHeadStr:${bnToAmountHeadStr};bnToAmountTailStr:${bnToAmountTailStr};`);
    slog.debug(`${fromToken.symbol.padStart(6)}|${toToken.symbol.padStart(6)}|${router.name.padStart(18)}|${bnToAmountHeadStr.padStart(5)}|${bnToAmountTailStr.padStart(19)}|${formatDate(startTime)}|${formatDate(endTime)}|${timeDiff.toFixed(3)}`);
    return bnToAmount;
};
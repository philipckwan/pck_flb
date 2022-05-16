import {getSwapsStrings, getBigNumber, formatDate} from "../utility";
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


export const fetchSwapPrices = async (aSwapRoutes:ISwapRoutes, loanAmountUSDx?:BigNumber) => {

    clog.debug(`index.fetchSwapPrices: START; ${getSwapsStrings(aSwapRoutes)};`);
    //for (let aSwapPairRoutes of aSwapRoutes.swapPairRoutes) {
    for (let i = 0; i < aSwapRoutes.swapPairRoutes.length; i++) {
      let aSwapPairRoutes = aSwapRoutes.swapPairRoutes[i];
      //let maxBN:BigNumber = getBigNumber(0);
      let maxRate:number = 0;
      let aLoanAmount = (i == 0) ? loanAmountUSDx : aSwapPairRoutes.fromAmount;
      for (let j = 0; j < aSwapPairRoutes.routerToAmountList.length; j++) {
      //for (let aRouteToAmount of aSwapPairRoutes.routerToAmountList) {
        let aRouteToAmount = aSwapPairRoutes.routerToAmountList[j];
        try {
          let amountAndRate = await getSwapAmountAndRate(aSwapPairRoutes.fromToken, aSwapPairRoutes.toToken, aRouteToAmount.router, aLoanAmount);
          aRouteToAmount.toFromRate = amountAndRate.toFromRate;
          aRouteToAmount.toAmount = amountAndRate.toAmount;        
          if (aRouteToAmount.toFromRate > maxRate) {
            aSwapRoutes.idxBestRouterToAmountList[i] = j;
            maxRate = aRouteToAmount.toFromRate;
          }        
        } catch (e) {
          aRouteToAmount.toFromRate = 0;
        } 
      }
      if (i != aSwapRoutes.swapPairRoutes.length - 1) {
        // has the next route, update next pair's fromAmount
        aSwapRoutes.swapPairRoutes[i+1].fromAmount = aSwapPairRoutes.routerToAmountList[aSwapRoutes.idxBestRouterToAmountList[i]].toAmount;
      } 
    }
    //printSwapRoutes(aSwapRoutes);
    clog.debug(`index.fetchSwapPrices: END;`);
  }
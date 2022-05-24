import * as log4js from "log4js";
//import {erc20Token, ERC20_TOKEN, routerAddress, SWAP_ROUTER} from "./addresses";

import {ethers} from "ethers";
import {IRouter, ISwapRoutes, ISwapPairRoutes} from "./interfaces";
import {ERC20_TOKEN, SWAP_ROUTER} from "./addresses";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
  
export const getBigNumber = (amount: number, decimals = 18) => {
    return ethers.utils.parseUnits(amount.toString(), decimals);
};

export const formatDate = (d: number) => {
    let aDate = new Date(d);
    let month = aDate.getMonth() + 1;
    let date = aDate.getDate();
    let hour = aDate.getHours();
    let minute = aDate.getMinutes();
    let second = aDate.getSeconds();
    let mSec = aDate.getMilliseconds();
    return `${date.toString().padStart(2,"0")}/${month.toString().padStart(2,"0")}@${hour.toString().padStart(2,"0")}:${minute.toString().padStart(2,"0")}:${second.toString().padStart(2,"0")}:${mSec.toString().padStart(3,"0")}`;
};

export const formatTime = (d: number) => {
  let aDate = new Date(d);
  let minute = aDate.getMinutes();
  let second = aDate.getSeconds();
  let mSec = aDate.getMilliseconds();
  return `${minute.toString().padStart(2,"0")}:${second.toString().padStart(2,"0")}:${mSec.toString().padStart(3,"0")}`;
}

export const parseRouterLists = (routersListStr:string) : IRouter[] => {
    let routers:IRouter[] = [];
    let routersListStrSplit = routersListStr.split(",");
    for (let aRouterStr of routersListStrSplit) {
      routers.push(SWAP_ROUTER[aRouterStr]);
    }
    return routers;
};

export const parseSwapLists = (swapRoutesListStr:string, routers:IRouter[], loanAmountUSDx:number) : ISwapRoutes[] => {
    let swapRoutesList:ISwapRoutes[] = [];

    let swapRouteListSplit:string[] = swapRoutesListStr.split(",");
    for (let aSwapRoutesStr of swapRouteListSplit) {
      
        let aSwapRoutes:ISwapRoutes = {swapPairRoutes:[], idxBestRouterToAmountList:[]};
        let aSwapRoutesSplit = aSwapRoutesStr.split(":");
        for (let i = 0; i < aSwapRoutesSplit.length-1; i++) {
          let fromTokenStr = aSwapRoutesSplit[i];
          let toTokenStr = aSwapRoutesSplit[i+1];
          let aSwapPairRoutes:ISwapPairRoutes = {
            fromToken : ERC20_TOKEN[fromTokenStr],
            toToken : ERC20_TOKEN[toTokenStr],
            fromAmount : getBigNumber(0),
            routerToAmountList : []
          };
  
          for (let aRouter of routers) {
            aSwapPairRoutes.routerToAmountList.push({router:aRouter, toAmount:getBigNumber(0), toFromRate:0});
          }
          // initialize the first pair's loan amount to loanAmountUSDx
          if (i == 0){
            aSwapPairRoutes.fromAmount = getBigNumber(loanAmountUSDx, aSwapPairRoutes.fromToken.decimals);
          }
          aSwapRoutes.swapPairRoutes.push(aSwapPairRoutes);
        }
        swapRoutesList.push(aSwapRoutes);
      }
      return swapRoutesList;
}

export const printSwapRoutes = (aSwapRoutes:ISwapRoutes) => {
    clog.debug(`utility.printSwapRoutes: START;`);
    for (let aSwapPairRoutes of aSwapRoutes.swapPairRoutes) {
      let fromAmountFixed = ethers.utils.formatUnits(aSwapPairRoutes.fromAmount,aSwapPairRoutes.fromToken.decimals);
      clog.debug(`--aSwapPairRoutes: ${aSwapPairRoutes.fromToken.symbol} -> ${aSwapPairRoutes.toToken.symbol}; $:${fromAmountFixed};`);
      for (let aRouterToAmount of aSwapPairRoutes.routerToAmountList) {
        let toAmountFixed = ethers.utils.formatUnits(aRouterToAmount.toAmount,aSwapPairRoutes.toToken.decimals);
        clog.debug(`----aRouter:${aRouterToAmount.router.name}; to$:${toAmountFixed}; rate:${aRouterToAmount.toFromRate.toFixed(4)};`);
      }
    }
    for (let i = 0; i < aSwapRoutes.idxBestRouterToAmountList.length; i++) {
      let idxBestRouterToAmount = aSwapRoutes.idxBestRouterToAmountList[i];
      let aBestRouterToAmount = aSwapRoutes.swapPairRoutes[i].routerToAmountList[idxBestRouterToAmount];
      let aBestToAmountFixed = ethers.utils.formatUnits(aBestRouterToAmount.toAmount,aSwapRoutes.swapPairRoutes[i].toToken.decimals);
      clog.debug(`--bestRouter[${i}]:${aBestRouterToAmount.router.name}; to$:${aBestToAmountFixed}; rate:${aBestRouterToAmount.toFromRate};`);
    }
    clog.debug(`utility.printSwapRoutes: END;`);
}

export const getSwapsStrings = (aSwapRoutes:ISwapRoutes) : string => {
  let result = "[";
  result += aSwapRoutes.swapPairRoutes[0].fromToken.symbol;
  for (let aSwapPairRoutes of aSwapRoutes.swapPairRoutes) {
    result += "-" + aSwapPairRoutes.toToken.symbol;
  }
  result += "]";
  return result;
}

export const compareSwap = (aSwapRoutes:ISwapRoutes) : [diffAmount:number, diffPct:number] => {
  let originalAmount = Number(ethers.utils.formatUnits(aSwapRoutes.swapPairRoutes[0].fromAmount,aSwapRoutes.swapPairRoutes[0].fromToken.decimals));
  //let finalRoute = aSwapRoutes.swapPairRoutes[aSwapRoutes.swapPairRoutes.length-1];
  //let finalIdx = aSwapRoutes.idxBestRouterToAmountList.length-1;
  //clog.debug(`compareSwap: finalIdx: ${finalIdx};`);
  //let finalRouterToAmount = finalRoute.routerToAmountList[aSwapRoutes.idxBestRouterToAmountList[finalIdx]];
  //let finalAmount = Number(ethers.utils.formatUnits(finalRouterToAmount.toAmount, finalRoute.toToken.decimals));
  let finalAmount = Number(ethers.utils.formatUnits(aSwapRoutes.swapPairRoutes[aSwapRoutes.swapPairRoutes.length-1].routerToAmountList[aSwapRoutes.idxBestRouterToAmountList[aSwapRoutes.idxBestRouterToAmountList.length-1]].toAmount, aSwapRoutes.swapPairRoutes[aSwapRoutes.swapPairRoutes.length-1].toToken.decimals)); 

  let diffAmount = finalAmount - originalAmount;
  let diffPct = diffAmount / originalAmount;

  return [diffAmount, diffPct];
}
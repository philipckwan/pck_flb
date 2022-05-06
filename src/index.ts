import { config as dotEnvConfig } from "dotenv";
let argEnv = process.argv[2] ? process.argv[2] : "";
dotEnvConfig({path:`${argEnv}.env`});
import * as log4js from "log4js";
import { getSwapPrice } from  "./uniswap/uniswapPrice";
import {ERC20_TOKEN, SWAP_ROUTER} from "./addresses";
import {IToken, IRouter, ISwapRoutes, ISwapPairRoutes} from "./interfaces";
import {getBigNumber} from "./utility";
import {BigNumber, ethers} from "ethers";

const flog=log4js.getLogger("file");
const clog=log4js.getLogger("console");

const init = () => {
  let fileLoggerLevel = process.env.FILE_LOGGER_LEVEL ? process.env.FILE_LOGGER_LEVEL : "debug";
  let consoleLoggerLevel = process.env.CONSOLE_LOGGER_LEVEL ? process.env.CONSOLE_LOGGER_LEVEL : "debug";
  let fileLoggerFilepath = process.env.FILE_LOGGER_FILEPATH ? process.env.FILE_LOGGER_FILEPATH : "log/pck_flb.log";
  let statsFileLoggerFilepath = process.env.STATSFILE_LOGGER_FILEPATH ? process.env.STATSFILE_LOGGER_FILEPATH : "log/stats.log";

  log4js.configure({
    appenders: {
      file: { type:"file", filename:fileLoggerFilepath},
      statsFile: { type:"file", filename:statsFileLoggerFilepath, layout:{type: 'pattern', pattern: '%m'}},
      console: { type:"console"}
    },
    categories: {
      file: { appenders:["file"], level: fileLoggerLevel },
      statsFile: { appenders:["statsFile"], level: "debug"},
      default: { appenders: ["console"], level: consoleLoggerLevel }
    },
  });
}

export const main = async () => {
    console.log("index.main: v0.4; START;");

    init();

    //loggerTest();
    let testVal = process.env.TEST_KEY;
    clog.debug(`__testVal:${testVal};`);

    let baseTokensList = process.env.BASE_TOKENS_LIST ? process.env.BASE_TOKENS_LIST.split(",") : [];
    let tradingTokensList = process.env.TRADING_TOKENS_LIST ? process.env.TRADING_TOKENS_LIST.split(",") : [];
    
    let routersList = process.env.ROUTERS_LIST ? process.env.ROUTERS_LIST.split(",") : [];
    let routers:IRouter[] = [];
    for (let aRouterStr of routersList) {
      routers.push(SWAP_ROUTER[aRouterStr]);
    }
    let loanAmountUSDx = process.env.LOAN_AMOUNT_USDX ? parseInt(process.env.LOAN_AMOUNT_USDX) : 0;

    let swapRouteListSplit = process.env.SWAP_ROUTE_LIST ? process.env.SWAP_ROUTE_LIST.split(",") : [];
    let swapRoutesList = [];
    for (let aSwapRoutesStr of swapRouteListSplit) {
      
      let aSwapRoutes:ISwapRoutes = {swapPairRoutes:[]};
      let aSwapRoutesSplit:string[] = aSwapRoutesStr.split(":");
      for (let i = 0; i < aSwapRoutesSplit.length-1; i++) {
        let fromTokenStr = aSwapRoutesSplit[i];
        let toTokenStr = aSwapRoutesSplit[i+1];
        let aSwapPairRoutes:ISwapPairRoutes = {
          fromToken : ERC20_TOKEN[fromTokenStr],
          toToken : ERC20_TOKEN[toTokenStr],
          fromAmount : getBigNumber(0),
          routeToAmounts : []
        };

        for (let aRouter of routers) {
          aSwapPairRoutes.routeToAmounts.push({router:aRouter, toAmount:getBigNumber(0)});
        }
        // initialize the first pair's loan amount to loanAmountUSDx
        if (i == 0){
          aSwapPairRoutes.fromAmount = getBigNumber(loanAmountUSDx, aSwapPairRoutes.fromToken.decimals);
        }

        aSwapRoutes.swapPairRoutes.push(aSwapPairRoutes);

        //aSwapRoutes.tokenRoute.push(ERC20_TOKEN[aSwapStr]);
      }
      //swapRouteList.push(newSwapRoute);
      fetchSwapPrices(aSwapRoutes);
    }



    //for(let aSwapRoute of swapRouteList) {
      
      //clog.debug(msg);
      //clog.debug(`__[${aSwapPair.from.symbol}] <-> [${aSwapPair.to.symbol}]`);
      /*
      let maxSwap1Amount = getBigNumber(0);
      for (let k = 0; k < routersList.length; k++) {
        let aRouter = SWAP_ROUTER[routersList[k]];
        if (!aRouter) {
          clog.warn(`index.main: router [${routersList[k]}] not found!`);
          continue;
        }
        let bnSwapAmount = await getSwapPrice(aSwapPair.from, aSwapPair.to, aRouter, loanAmountUSDx);
        clog.debug(`index.main: bnSwapAmount: [${bnSwapAmount}];`);
      }
      */
    //}
    
    /*
    for (let i = 0; i < baseTokensList.length; i++) {
      let fromToken = ERC20_TOKEN[baseTokensList[i]];
      if (!fromToken) {
        clog.warn(`index.main: token [${baseTokensList[i]}] not found!`);
        continue;
      }
      for (let j = 0; j < tradingTokensList.length; j++) {
        if (i == j) continue;
        let toToken = ERC20_TOKEN[tradingTokensList[j]];
        if (!toToken) {
          clog.warn(`index.main: token [${tradingTokensList[j]}] not found!`);
          continue;
        }
        
        for (let k = 0; k < routersList.length; k++) {
          let aRouter = SWAP_ROUTER[routersList[k]];
          if (!aRouter) {
            clog.warn(`index.main: router [${routersList[k]}] not found!`);
            continue;
          }
          let bnSwapAmount = await getSwapPrice(fromToken, toToken, aRouter, loanAmountUSDx);
          clog.debug(`index.main: bnSwapAmount: [${bnSwapAmount}];`);
        }
      }
      */
      //clog.debug(`_token:${aToken.symbol};address:${aToken.address};`);

    console.log("index.main: END;");
};

const fetchSwapPrices = async (aSwapRoutes:ISwapRoutes) => {
  clog.debug(`index.fetchSwapPrices: START;`);
  //for (let aSwapPairRoutes of aSwapRoutes.swapPairRoutes) {
  for (let i = 0; i < aSwapRoutes.swapPairRoutes.length; i++) {
    let aSwapPairRoutes = aSwapRoutes.swapPairRoutes[i];
    let maxBN:BigNumber = getBigNumber(0);
    for (let aRouteToAmount of aSwapPairRoutes.routeToAmounts) {
      try {
        let bnSwapAmount = await getSwapPrice(aSwapPairRoutes.fromToken, aSwapPairRoutes.toToken, aRouteToAmount.router, aSwapPairRoutes.fromAmount);
        aRouteToAmount.toAmount = bnSwapAmount;
        if (maxBN < bnSwapAmount) {
          maxBN = bnSwapAmount;
        }
      } catch (e) {
        aRouteToAmount.toAmount = getBigNumber(-1);
      } 
    }
    if (i != aSwapRoutes.swapPairRoutes.length - 1) {
      // has the next route
      aSwapRoutes.swapPairRoutes[i+1].fromAmount = maxBN;
    }
  }
  printSwapRoutes(aSwapRoutes);
  clog.debug(`index.fetchSwapPrices: END;`);
}

const printSwapRoutes = (aSwapRoutes:ISwapRoutes) => {
  clog.debug(`index.printSwapRoutes: START;`);
  for (let aSwapPairRoutes of aSwapRoutes.swapPairRoutes) {
    let fromAmountFixed = Number(ethers.utils.formatUnits(aSwapPairRoutes.fromAmount,aSwapPairRoutes.fromToken.decimals));
    clog.debug(`--aSwapPairRoutes: ${aSwapPairRoutes.fromToken.symbol} -> ${aSwapPairRoutes.toToken.symbol}; $${fromAmountFixed};`);
    for (let aRouteToAmount of aSwapPairRoutes.routeToAmounts) {
      let toAmountFixed = Number(ethers.utils.formatUnits(aRouteToAmount.toAmount,aSwapPairRoutes.toToken.decimals));
      clog.debug(`----aRouter:${aRouteToAmount.router.name}; to$${toAmountFixed};`);
    }
  }
  clog.debug(`index.printSwapRoutes: END;`);
}

const loggerTest = () => {
    let msg = "index.main: test DEBUG";
    flog.debug(msg);
    clog.debug(msg);

    msg = "index.main: test INFO";
    flog.info(msg);
    clog.info(msg);

    msg = "index.main: test WARN";
    flog.warn(msg);
    clog.warn(msg);

    msg = "index.main: test ERROR";
    flog.error(msg);
    clog.error(msg);

    msg = "index.main: test FATAL";
    flog.fatal(msg);
    clog.fatal(msg);
}
 
main();
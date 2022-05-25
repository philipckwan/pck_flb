import { config as dotEnvConfig } from "dotenv";
let argEnv = process.argv[2] ? process.argv[2] : "";
dotEnvConfig({path:`${argEnv}.env`});
import * as log4js from "log4js";
import {getBigNumber, parseRouterLists, parseSwapLists, printSwapRoutes, compareSwap, getSwapsStrings, formatTime} from "./utility";
import {fetchSwapPrices} from "./uniswap/uniswapPrice";
import {PCKFLBConfig} from "./config";
import {gasPriceCalculator} from "./utils/GasPriceCalculator";
import {PCKFlashloanExecutor} from "./flashloan/FlashloanExecutor";
import {PCKWeb3Handler} from "./utils/Web3Handler";
import {PCKPriceV3} from "./uniswap/priceV3";
import {PCKParallelTwoSwapsStrategy} from "./strategy/ParallelTwoSwapsStrategy";

const flog=log4js.getLogger("file");
const clog=log4js.getLogger("console");

const init = () => {
  let fileLoggerLevel = process.env.FILE_LOGGER_LEVEL ? process.env.FILE_LOGGER_LEVEL : "debug";
  let consoleLoggerLevel = process.env.CONSOLE_LOGGER_LEVEL ? process.env.CONSOLE_LOGGER_LEVEL : "debug";
  let fileLoggerFilepath = process.env.FILE_LOGGER_FILEPATH ? process.env.FILE_LOGGER_FILEPATH : "log/pck_flb.log";
  let statsFileLoggerFilepath = process.env.STATSFILE_LOGGER_FILEPATH ? process.env.STATSFILE_LOGGER_FILEPATH : "log/pck_stats.log";

  log4js.configure({
    appenders: {
      file: { type:"file", filename:fileLoggerFilepath, layout:{type:"pattern", pattern:"%d{MM/ddThh:mm:ss:SSS};%p;%m"}},
      statsFile: { type:"file", filename:statsFileLoggerFilepath, layout:{type:"pattern", pattern:"%m"}},
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
    console.log("index.main: START;");

    init();
    //let startTime = Date.now();

    //loggerTest();
    let testVal = process.env.TEST_KEY;
    let pollIntervalMSec = process.env.POLL_INTERVAL_MSEC ? parseInt(process.env.POLL_INTERVAL_MSEC) : 10000;
    let msg = `index.main: v1.5; testVal:${testVal}; pollIntervalMSec:${pollIntervalMSec};`;
    clog.debug(msg);
    flog.debug(msg);

    PCKFLBConfig.init();
    PCKFLBConfig.logConfigs();

    PCKWeb3Handler.init();
    PCKPriceV3.init();    

    gasPriceCalculator.init();
    gasPriceCalculator.logConfigs();

    let routersListStr = process.env.ROUTERS_LIST ? process.env.ROUTERS_LIST : "";
    let routersList = parseRouterLists(routersListStr);

    let swapRouteListStr = process.env.SWAP_ROUTE_LIST ? process.env.SWAP_ROUTE_LIST : "";
    let swapRoutesList = parseSwapLists(swapRouteListStr, routersList, PCKFLBConfig.loanAmountUSDx);

    

    let isFlashloanInProgress=false;
    if (PCKFLBConfig.isParallelTwoSwapsStrategy) {
      PCKParallelTwoSwapsStrategy.init(swapRoutesList);
      for (let i = 0; i < swapRoutesList.length; i++) {
        let aSwapRoutes = swapRoutesList[i];
        let bnLoanAmountUSDx = getBigNumber(PCKFLBConfig.loanAmountUSDx, aSwapRoutes.swapPairRoutes[0].fromToken.decimals);
        await PCKParallelTwoSwapsStrategy.add(aSwapRoutes.swapPairRoutes[0], aSwapRoutes.swapPairRoutes[1], bnLoanAmountUSDx);
        PCKParallelTwoSwapsStrategy.printTwoSwaps(i);
      }
    }

    for (let i = 0; i < swapRoutesList.length; i++) { //let aSwapRoutes of swapRoutesList) {
      //printSwapRoutes(aSwapRoutes);  
      let aSwapRoutes = swapRoutesList[i];
      let bnLoanAmountUSDx = getBigNumber(PCKFLBConfig.loanAmountUSDx, aSwapRoutes.swapPairRoutes[0].fromToken.decimals);
      
      const func = async () => {
        let isOpp = false;
        if (PCKFLBConfig.isParallelTwoSwapsStrategy) {
          if (!PCKParallelTwoSwapsStrategy.isBusy) {
          PCKParallelTwoSwapsStrategy.refresh(i);
          } else {
            flog.debug(`index.main.func: PCKParallelTwoSwapsStrategy is busy, skipping execution for now...`);
          }
        } else {
          //clog.debug(`index.main.func: START; ${getSwapsStrings(aSwapRoutes)};`);
          let startTime = Date.now();
          await fetchSwapPrices(aSwapRoutes, bnLoanAmountUSDx);
          let endTime = Date.now();
          let timeDiff = (endTime - startTime) / 1000;
          let [diffAmt, diffPct] = compareSwap(aSwapRoutes);
          isOpp = diffAmt > PCKFLBConfig.flashloanExecutionThresholdUSDx;
          flog.debug(`index.main.func: oldStrategy; ${getSwapsStrings(aSwapRoutes)}; isOpp:${isOpp}; diffAmt:${diffAmt.toFixed(2)}, diffPct:${diffPct.toFixed(5)};T:[${formatTime(startTime)}->${formatTime(endTime)}(${timeDiff})];`);
        }
        if (isFlashloanInProgress) {
          flog.debug(`index.main.func: a flashloan execution is in progress, will skip this flashloan...`);
          return;
        }
        if (isOpp) {
          isFlashloanInProgress=true;
          let fromTokenSymbol = aSwapRoutes.swapPairRoutes[0].fromToken.symbol;
          let toTokenSymbol = aSwapRoutes.swapPairRoutes[0].toToken.symbol;
          let firstBestRouteIdx = aSwapRoutes.idxBestRouterToAmountList[0];
          let firstBestRouterName= aSwapRoutes.swapPairRoutes[0].routerToAmountList[firstBestRouteIdx].router.name;
          let firstBestRouterRate = aSwapRoutes.swapPairRoutes[0].routerToAmountList[firstBestRouteIdx].toFromRate;
          let secondBestRouteIdx = aSwapRoutes.idxBestRouterToAmountList[1];
          let secondBestRouterName= aSwapRoutes.swapPairRoutes[1].routerToAmountList[secondBestRouteIdx].router.name;
          let secondBestRouterRate = aSwapRoutes.swapPairRoutes[1].routerToAmountList[secondBestRouteIdx].toFromRate;
          let finalRate = firstBestRouterRate * secondBestRouterRate;
          let msg = `index.main.func: winning route:[${fromTokenSymbol}]->[${firstBestRouterName}:${toTokenSymbol}:${firstBestRouterRate}]->[${secondBestRouterName}:${fromTokenSymbol}:${secondBestRouterRate}]; %:${finalRate.toFixed(5)};`;
          flog.debug(msg);
          
          if (PCKFLBConfig.remainingFlashloanTries > 0) {
            flog.debug(`index.main.func: about to execute flashloan; final%${finalRate.toFixed(5)};`);
            let results = await PCKFlashloanExecutor.executeFlashloan(aSwapRoutes);
            PCKFLBConfig.remainingFlashloanTries--;
            flog.debug(`index.main.func: flashloan executed, results=${results}; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
          } else {
            flog.debug(`index.main.func: will not execute flashloan; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
          }
          isFlashloanInProgress=false;
        }
      }
      //func();  
      setInterval(func, pollIntervalMSec);
    }
    
    console.log("index.main: END;");
};

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
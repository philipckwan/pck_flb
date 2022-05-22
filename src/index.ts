import { config as dotEnvConfig } from "dotenv";
let argEnv = process.argv[2] ? process.argv[2] : "";
dotEnvConfig({path:`${argEnv}.env`});
import * as log4js from "log4js";
import {getBigNumber, parseRouterLists, parseSwapLists, printSwapRoutes, compareSwap, getSwapsStrings} from "./utility";
import {fetchSwapPrices} from "./uniswap/uniswapPrice";
import {PCKFLBConfig} from "./config";
import {gasPriceCalculator} from "./utils/GasPriceCalculator";
import {PCKFlashloanExecutor} from "./flashloan/FlashloanExecutor";
import {PCKWeb3Handler} from "./utils/Web3Handler";
import {PCKPriceV3} from "./uniswap/priceV3";

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
    let msg = `index.main: v1.0; testVal:${testVal}; pollIntervalMSec:${pollIntervalMSec};`;
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

    /*
    if (true) {
      log4js.shutdown(function() { process.exit(1); });
    }
    //*/

    for (let aSwapRoutes of swapRoutesList) {
      //printSwapRoutes(aSwapRoutes);  
      let bnLoanAmountUSDx = getBigNumber(PCKFLBConfig.loanAmountUSDx, aSwapRoutes.swapPairRoutes[0].fromToken.decimals);
      const func = async () => {
        //clog.debug(`index.main.func: START; ${getSwapsStrings(aSwapRoutes)};`);
        await fetchSwapPrices(aSwapRoutes, bnLoanAmountUSDx);
        let [diffAmt, diffPct] = compareSwap(aSwapRoutes);
        let isOpp = diffAmt > PCKFLBConfig.flashloanExecutionThresholdUSDx;
        flog.debug(`index.main.func: ${getSwapsStrings(aSwapRoutes)};isOpp:${isOpp}; diffAmt:${diffAmt}, diffPct:${diffPct};`);
        if (isFlashloanInProgress) {
          flog.debug(`index.main.func: a flashloan execution is in progress, will skip this flashloan...`);
          return;
        }
        if (isOpp) {
          //flog.debug(`index.main.func: gasPrice:${await gasPriceCalculator.getGasPrice()}`);
          if (PCKFLBConfig.remainingFlashloanTries > 0) {
            let results = await PCKFlashloanExecutor.executeFlashloan(aSwapRoutes);
            PCKFLBConfig.remainingFlashloanTries--;
            flog.debug(`index.main.func: flashloan executed, results=${results}; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
          } else {
            flog.debug(`index.main.func: will not execute flashloan; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
          }

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
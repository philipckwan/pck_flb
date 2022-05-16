import { config as dotEnvConfig } from "dotenv";
let argEnv = process.argv[2] ? process.argv[2] : "";
dotEnvConfig({path:`${argEnv}.env`});
import * as log4js from "log4js";
import {ISwapRoutes} from "./interfaces";
import {getBigNumber, parseRouterLists, parseSwapLists, printSwapRoutes, compareSwap, getSwapsStrings} from "./utility";
import {fetchSwapPrices} from "./uniswap/uniswapPrice";
import {BigNumber} from "ethers";

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
    console.log("index.main: v0.8; START;");

    init();

    //let startTime = Date.now();

    //loggerTest();
    let testVal = process.env.TEST_KEY;
    clog.debug(`__testVal:${testVal};`);

    //let baseTokensList = process.env.BASE_TOKENS_LIST ? process.env.BASE_TOKENS_LIST.split(",") : [];
    //let tradingTokensList = process.env.TRADING_TOKENS_LIST ? process.env.TRADING_TOKENS_LIST.split(",") : [];
    
    let routersListStr = process.env.ROUTERS_LIST ? process.env.ROUTERS_LIST : "";
    let routersList = parseRouterLists(routersListStr);

    let loanAmountUSDx = process.env.LOAN_AMOUNT_USDX ? parseInt(process.env.LOAN_AMOUNT_USDX) : 0;

    let swapRouteListStr = process.env.SWAP_ROUTE_LIST ? process.env.SWAP_ROUTE_LIST : "";
    let swapRoutesList = parseSwapLists(swapRouteListStr, routersList, loanAmountUSDx);
    
    for (let aSwapRoutes of swapRoutesList) {
      //printSwapRoutes(aSwapRoutes);  
      let bnLoanAmountUSDx = getBigNumber(loanAmountUSDx, aSwapRoutes.swapPairRoutes[0].fromToken.decimals);
      const func = async () => {
        //clog.debug(`index.main.func: START; ${getSwapsStrings(aSwapRoutes)};`);
        await fetchSwapPrices(aSwapRoutes, bnLoanAmountUSDx);
        let [diffAmt, diffPct] = compareSwap(aSwapRoutes);
        flog.debug(`index.main.func: ${getSwapsStrings(aSwapRoutes)}, diffAmt:${diffAmt}, diffPct:${diffPct};`);
        //clog.debug(`index.main.func: ${getSwapsStrings(aSwapRoutes)}, diffAmt:${diffAmt}, diffPct:${diffPct};`);
      }
      func();  
      setInterval(func, 10000);
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
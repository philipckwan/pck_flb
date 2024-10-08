import { config as dotEnvConfig } from "dotenv";
let argEnv = process.argv[2] ? process.argv[2] : "";
dotEnvConfig({path:`${argEnv}.env`});
import * as log4js from "log4js";
//import {parseRouterLists, parseSwapLists, printSwapRoutes} from "./utility";
import {PCKFLBConfig} from "./config";
import {gasPriceCalculator} from "./utils/GasPriceCalculator";
import {PCKWeb3Handler} from "./utils/Web3Handler";
//import {PCKPriceV3} from "./uniswap/priceV3";
//import {quoter} from "./utils/Quoter";
//import {ParallelMultiTradesStrategy} from "./strategy/ParallelMultiTradesStrategy";
//import {PCKFlashloanExecutor} from "./flashloan/FlashloanExecutor";

const flog=log4js.getLogger("file");
const clog=log4js.getLogger("console");

const init = () => {
  let fileLoggerLevel = process.env.FILE_LOGGER_LEVEL ? process.env.FILE_LOGGER_LEVEL : "debug";
  let consoleLoggerLevel = process.env.CONSOLE_LOGGER_LEVEL ? process.env.CONSOLE_LOGGER_LEVEL : "debug";
  let fileLoggerFilepath = process.env.FILE_LOGGER_FILEPATH ? process.env.FILE_LOGGER_FILEPATH : "log/pck_flb.log";
  let statsFileLoggerFilepath = process.env.STATSFILE_LOGGER_FILEPATH ? process.env.STATSFILE_LOGGER_FILEPATH : "log/pck_stats.log";
  let flashloanTxLoggerFilepath = process.env.FLASHLOAN_TX_LOGGER_FILEPATH ? process.env.FLASHLOAN_TX_LOGGER_FILEPATH : "log/pck-flashloan_tx.log";
  let blockNumLoggerFilepath = process.env.BLOCKNUM_LOGGER_FILEPATH ? process.env.BLOCKNUM_LOGGER_FILEPATH : "log/pck-blockNum.log";
  let blockPollLoggerFilepath = process.env.BLOCKPOLL_LOGGER_FILEPATH ? process.env.BLOCKPOLL_LOGGER_FILEPATH : "log/pck-blockPoll.log";

  log4js.configure({
    appenders: {
      file: { type:"file", filename:fileLoggerFilepath, layout:{type:"pattern", pattern:"%d{MM/ddThh:mm:ss:SSS};%m"}},
      statsFile: { type:"file", filename:statsFileLoggerFilepath, layout:{type:"pattern", pattern:"%m"}},
      flashloanTxFile: { type:"file", filename:flashloanTxLoggerFilepath, layout:{type:"pattern", pattern:"%d{MM/ddThh:mm:ss:SSS};%m"}},
      blockNumFile: { type:"file", filename:blockNumLoggerFilepath, layout:{type:"pattern", pattern:"%m"}},
      blockPollFile: { type:"file", filename:blockPollLoggerFilepath, layout:{type:"pattern", pattern:"%m"}},
      console: { type:"console"}
    },
    categories: {
      file: { appenders:["file"], level: fileLoggerLevel },
      statsFile: { appenders:["statsFile"], level: "debug"},
      flashloanTxFile: { appenders:["flashloanTxFile"], level: "debug"},
      blockNumFile: { appenders:["blockNumFile"], level: "debug"},
      blockPollFile: { appenders:["blockPollFile"], level: "debug"},
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
    let msg = `index.main: v2.24; testVal:${testVal};`;
    clog.debug(msg);
    flog.debug(msg);

    PCKFLBConfig.init();
    if (process.argv.length > 3) {
      clog.debug(`index.main: extra arguments are passed in;`);
      let arg4 = process.argv[3];
      if (arg4 == "noFlash") {
        clog.debug(`index.main: will not flashloan...`);
        PCKFLBConfig.isDoFlashloan = false;
      } else if (arg4 == "forceFlash") {
        PCKFLBConfig.isForceFlashloan = true;
      }
      let arg5 = process.argv[4];
      if (arg5 == "refreshOnce") {
        clog.debug(`index.main: will refresh once...`);
        PCKFLBConfig.isRefreshOnce = true;
      }
    }
    PCKFLBConfig.display();

    PCKWeb3Handler.init();
    //PCKPriceV3.init();    
    //quoter.init(PCKWeb3Handler.localWeb3Provider, PCKWeb3Handler.alchemyWeb3Provider);

    gasPriceCalculator.init();
    gasPriceCalculator.display();

    //PCKFlashloanExecutor.init(PCKWeb3Handler.localWeb3Provider, PCKWeb3Handler.alchemyWeb3Provider);

    /*
    let thisStrategy:Strategy;
    if (PCKFLBConfig.arbStrategy === Strategy.MODE[Strategy.MODE.PARALLEL_V2]) {
      let msg = `index.main: ERROR - PTSS is now obsoleted;`;
      clog.error(msg);
      flog.error(msg);
      throw new Error(msg);
    } else if (PCKFLBConfig.arbStrategy === Strategy.MODE[Strategy.MODE.PMTS_V1]) {
      thisStrategy = new ParallelMultiTradesStrategy()
      thisStrategy.init();
    } else {
      let msg = `index.main: ERROR - unknown strategy:${PCKFLBConfig.arbStrategy};`;
      clog.error(msg);
      flog.error(msg);
      throw new Error(msg);
    }
    thisStrategy.display();
    */

    //log4js.shutdown(function() { process.exit(1); });



    //PCKWeb3Handler.setFlashloanStrategy(thisStrategy);

    /*
    const func = async () => {
      thisStrategy.refreshAll();
    }
    setInterval(func, pollIntervalMSec);    
    */
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
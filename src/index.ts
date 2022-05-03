import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();
import * as log4js from "log4js";
import { utilityTest } from  "./utility";

const flog=log4js.getLogger("file");
const clog = log4js.getLogger("console");

const log4jsConfigure = (fileLoggerLevel:string, consoleLoggerLevel:string) => {
    log4js.configure({
        appenders: {
          file: { type:"file", filename:"log/pck_flb.log"},
          console: { type:"console"}
        },
        categories: {
          file: { appenders:["file"], level: fileLoggerLevel },
          default: { appenders: ["console"], level: consoleLoggerLevel }
        },
      });
      
      //flog = log4js.getLogger("file");
      //clog = log4js.getLogger("console");
    
};

export const main = async () => {
    console.log("index.main: v0.2; START;");

    let fileLoggerLevel = process.env.FILE_LOGGER_LEVEL ? process.env.FILE_LOGGER_LEVEL : "debug";
    let consoleLoggerLevel = process.env.CONSOLE_LOGGER_LEVEL ? process.env.CONSOLE_LOGGER_LEVEL : "debug";
    log4jsConfigure(fileLoggerLevel, consoleLoggerLevel);

    loggerTest();

    let testValue = process.env.TEST_KEY;
    clog.debug(`_testValue:${testValue};`);

    utilityTest();

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
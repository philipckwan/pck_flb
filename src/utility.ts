import * as log4js from "log4js";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");

export const utilityTest = () => {
    clog.debug("utility.utilityTest: DEBUG;");
    clog.info("utility.utilityTest: INFO;");
    clog.warn("utility.utilityTest: WARN;");
    clog.error("utility.utilityTest: ERROR;");
    clog.fatal("utility.utilityTest: FATAL;");
};
import * as log4js from "log4js";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");

class Config
{
    private static _instance: Config;

    private constructor() {
    }

    public static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public gasLimit:number;
    public gasPriceMultiplier:number;
    public gasPriceAdder:number;
    public isAPIGetGasPrice:boolean;
    public gasPriceLimit:number;
    public remainingFlashloanTries:number;
    public isInited:boolean = false;
    public polygonAPIKey:string;

    public init() {
        if (this.isInited) {
            let msg = `Config.init: WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
        }

        this.gasLimit = 15000000;
        let gasPriceOptions = process.env.GAS_PRICE_OPTIONS ? process.env.GAS_PRICE_OPTIONS : "*1";
        let firstChar = gasPriceOptions.charAt(0);
        let restChars = gasPriceOptions.substring(1);
        this.isAPIGetGasPrice = (firstChar == '*' || firstChar == '+' || firstChar == '-') ? true : false;
        if (this.isAPIGetGasPrice == true) {
            if (firstChar == '*') {
                this.gasPriceMultiplier = parseFloat(restChars);
                this.gasPriceAdder = 0;
            } else if (firstChar == '+') {
                this.gasPriceMultiplier = 1;
                this.gasPriceAdder = parseInt(restChars);
            } else {
                // invalid case
                let msg = `Config.init: ERROR - invalid input; firstChar:${firstChar};`;
                clog.error(msg);
                flog.error(msg);
                log4js.shutdown(function() { process.exit(1); });
            }
        } else {
            this.gasPriceMultiplier = 0;
            this.gasPriceAdder = parseInt(gasPriceOptions);
        }
        this.gasPriceLimit = process.env.GAS_PRICE_LIMIT ? parseInt(process.env.GAS_PRICE_LIMIT) : 300;
        this.remainingFlashloanTries = process.env.MAX_NUM_SUCCESSFUL_FLASHLOAN ? parseInt(process.env.MAX_NUM_SUCCESSFUL_FLASHLOAN) : 0;
        this.polygonAPIKey = process.env.POLYGON_API_KEY ? process.env.POLYGON_API_KEY : "abcdefgh";
        this.isInited = true;
        
    }

    public logConfigs () {
        let msg = `Config.logConfigs: v0.1; gasLimit:${this.gasLimit}; isAPIGetGasPrice:${this.isAPIGetGasPrice}; gasPriceMultiplier:${this.gasPriceMultiplier}; gasPriceAdder:${this.gasPriceAdder}; gasPriceLimit:${this.gasPriceLimit}; remainingFlashloanTries:${this.remainingFlashloanTries}; polygonAPIKey:${this.polygonAPIKey}`;
        clog.debug(msg);
        flog.debug(msg);
    }
}


export const PCKFLBConfig = Config.Instance;

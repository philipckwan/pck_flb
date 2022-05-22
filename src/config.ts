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
    public loanAmountUSDx:number;
    public flashloanExecutionThresholdUSDx:number;
    public privateKey:string;
    public web3RPCURL:string;
    public flashloanContractAddress:string;
    public getGasPriceField:string;
    public isUseRecentGasPrice:boolean;


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
        
        this.loanAmountUSDx = process.env.LOAN_AMOUNT_USDX ? parseInt(process.env.LOAN_AMOUNT_USDX) : 0;
        this.flashloanExecutionThresholdUSDx = process.env.FLASHLOAN_EXECUTE_THRESHOLD_USDX ? parseInt(process.env.FLASHLOAN_EXECUTE_THRESHOLD_USDX) : 10;

        this.web3RPCURL = process.env.WEB3_RPC_URL ? process.env.WEB3_RPC_URL : "";
        this.privateKey = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY : "";
        this.flashloanContractAddress = process.env.FLASHLOAN_CONTRACT_ADDRESS ? process.env.FLASHLOAN_CONTRACT_ADDRESS : "";

        this.getGasPriceField = process.env.GET_GAS_PRICE_FIELD ? process.env.GET_GAS_PRICE_FIELD : "";
        this.isUseRecentGasPrice = process.env.IS_USE_RECENT_GAS_PRICE ? process.env.IS_USE_RECENT_GAS_PRICE  === "true": false;

        let msg = `Config.init: DONE;`;
        clog.info(msg);
        flog.info(msg);
        
        this.isInited = true;
    }

    public logConfigs () {
        let msg=`Config.logConfigs: v0.3; gasLimit:${this.gasLimit}; isAPIGetGasPrice:${this.isAPIGetGasPrice}; gasPriceMultiplier:${this.gasPriceMultiplier}; gasPriceAdder:${this.gasPriceAdder}; gasPriceLimit:${this.gasPriceLimit};`; 
        clog.debug(msg);
        flog.debug(msg);

        msg=`Config.logConfigs: remainingFlashloanTries:${this.remainingFlashloanTries}; polygonAPIKey:${this.polygonAPIKey}; loanAmountUSDx:${this.loanAmountUSDx}; flashloanExecutionThresholdUSDx:${this.flashloanExecutionThresholdUSDx};`;
        clog.debug(msg);
        flog.debug(msg);

        msg=`Config.logConfigs: web3RPCURL:${this.web3RPCURL}; privateKey(partial):${this.privateKey.substring(0,6)}...; flashloanContractAddress:${this.flashloanContractAddress};`;
        clog.debug(msg);
        flog.debug(msg);
    }
}


export const PCKFLBConfig = Config.Instance;

import * as log4js from "log4js";
const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
import {ERC20_TOKEN} from "./addresses";
import {IToken, IRouter} from "./interfaces";
import {parseRouterLists} from "./utility";

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
    public privateKey:string;
    //public web3RPCURL:string;
    public flashloanContractAddress:string;
    public getGasPriceField:string;
    public isUseRecentGasPrice:boolean;
    //public arbStrategy:string;
    public baseToken:IToken;
    public tradeTokens:IToken[] = [];
    public routers:IRouter[] = [];
    //public currentBlkNumber:number = 0;

    public pollHeartbeatMSec:number;

    public alchemyWeb3URL:string;
    //public alchemyBlockNumPollIntervalMsec:number;
    public alchemyBlockNumPollIntervalPattern:string;
    public alchemyBlockNumPollEnabled:boolean = false;
    public alchemyFlashloanCheckEnabled:boolean = false;

    public quicknodeWeb3URL:string;
    //public quicknodeBlockNumPollIntervalMsec:number;
    public quicknodeBlockNumPollIntervalPattern:string;
    public quicknodeBlockNumPollEnabled:boolean = false;
    public quicknodeFlashloanCheckEnabled:boolean = false;

    public localWeb3URL:string;
    //public localBlockNumPollIntervalMsec:number;
    public localBlockNumPollIntervalPattern:string;
    public localBlockNumPollEnabled:boolean = false;
    public localFlashloanCheckEnabled:boolean = false;
    public localBlockNumSkewTolerance:number;

    public isDoFlashloan:boolean = true;
    public isForceFlashloan:boolean = false;
    public isRefreshOnce:boolean = false;

    public init() {
        if (this.isInited) {
            let msg = `Config.init: WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
        }

        this.gasLimit = process.env.GAS_LIMIT ? parseInt(process.env.GAS_LIMIT) : 12000000;
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
        
        //this.web3RPCURL = process.env.WEB3_RPC_URL ? process.env.WEB3_RPC_URL : "";
        this.privateKey = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY : "";
        this.flashloanContractAddress = process.env.FLASHLOAN_CONTRACT_ADDRESS ? process.env.FLASHLOAN_CONTRACT_ADDRESS : "";

        this.getGasPriceField = process.env.GET_GAS_PRICE_FIELD ? process.env.GET_GAS_PRICE_FIELD : "";
        this.isUseRecentGasPrice = process.env.IS_USE_RECENT_GAS_PRICE ? process.env.IS_USE_RECENT_GAS_PRICE  === "true": false;
        
        let baseTokenStr = process.env.BASE_TOKEN ? process.env.BASE_TOKEN : "n/a";
        let baseTokenStrSplit = baseTokenStr.split(":");
        this.baseToken = ERC20_TOKEN[baseTokenStrSplit[0].toUpperCase()];
        this.baseToken.amountForSwap = Number(baseTokenStrSplit[1]);

        let tradeTokensStr = process.env.TRADE_TOKENS ? process.env.TRADE_TOKENS : "n/a";
        let tradeTokensSplit = tradeTokensStr.split(",");
        for (let i = 0; i < tradeTokensSplit.length; i++) {
            let aTradeTokenStrSplit = tradeTokensSplit[i].split(":");
            let aTradeToken = ERC20_TOKEN[aTradeTokenStrSplit[0].toUpperCase()];
            aTradeToken.amountForSwap = Number(aTradeTokenStrSplit[1]);
            this.tradeTokens.push(aTradeToken);
        }

        let routersListStr = process.env.ROUTERS_LIST ? process.env.ROUTERS_LIST : "";
        this.routers = parseRouterLists(routersListStr);

        this.pollHeartbeatMSec = process.env.POLL_HEARTBEAT_MSEC ? parseInt(process.env.POLL_HEARTBEAT_MSEC) : 200;

        this.alchemyWeb3URL = process.env.ALCHEMY_RPC_URL ? process.env.ALCHEMY_RPC_URL : "";
        //this.alchemyBlockNumPollIntervalMsec = process.env.ALCHEMY_BLOCKNUM_POLL_INTERVAL_MSEC ? parseInt(process.env.ALCHEMY_BLOCKNUM_POLL_INTERVAL_MSEC) : 2000;
        this.alchemyBlockNumPollIntervalPattern = process.env.ALCHEMY_BLOCKNUM_POLL_INTERVAL_PATTERN ? process.env.ALCHEMY_BLOCKNUM_POLL_INTERVAL_PATTERN : "2200";
        this.alchemyBlockNumPollEnabled = process.env.ALCHEMY_BLOCKNUM_POLL_ENABLED ? process.env.ALCHEMY_BLOCKNUM_POLL_ENABLED  === "true": false;
        this.alchemyFlashloanCheckEnabled = process.env.ALCHEMY_FLASHLOAN_CHECK_ENABLED ? process.env.ALCHEMY_FLASHLOAN_CHECK_ENABLED  === "true": false;

        this.quicknodeWeb3URL = process.env.QUICKNODE_RPC_URL ? process.env.QUICKNODE_RPC_URL : "";
        //this.quicknodeBlockNumPollIntervalMsec = process.env.QUICKNODE_BLOCKNUM_POLL_INTERVAL_MSEC ? parseInt(process.env.QUICKNODE_BLOCKNUM_POLL_INTERVAL_MSEC) : 2000;
        this.quicknodeBlockNumPollIntervalPattern = process.env.QUICKNODE_BLOCKNUM_POLL_INTERVAL_PATTERN ? process.env.QUICKNODE_BLOCKNUM_POLL_INTERVAL_PATTERN : "2200";
        this.quicknodeBlockNumPollEnabled = process.env.QUICKNODE_BLOCKNUM_POLL_ENABLED ? process.env.QUICKNODE_BLOCKNUM_POLL_ENABLED  === "true": false;
        this.quicknodeFlashloanCheckEnabled = process.env.QUICKNODE_FLASHLOAN_CHECK_ENABLED ? process.env.QUICKNODE_FLASHLOAN_CHECK_ENABLED  === "true": false;

        this.localWeb3URL = process.env.LOCAL_RPC_URL ? process.env.LOCAL_RPC_URL : "";
        //this.localBlockNumPollIntervalMsec = process.env.LOCAL_BLOCKNUM_POLL_INTERVAL_MSEC ? parseInt(process.env.LOCAL_BLOCKNUM_POLL_INTERVAL_MSEC) : 2000;
        this.localBlockNumPollIntervalPattern = process.env.LOCAL_BLOCKNUM_POLL_INTERVAL_PATTERN ? process.env.LOCAL_BLOCKNUM_POLL_INTERVAL_PATTERN : "2100";
        this.localBlockNumPollEnabled = process.env.LOCAL_BLOCKNUM_POLL_ENABLED ? process.env.LOCAL_BLOCKNUM_POLL_ENABLED  === "true": false;
        this.localFlashloanCheckEnabled = process.env.LOCAL_FLASHLOAN_CHECK_ENABLED ? process.env.LOCAL_FLASHLOAN_CHECK_ENABLED  === "true": false;
        this.localBlockNumSkewTolerance = process.env.LOCAL_BLOCKNUM_SKEW_TOLERANCE ? parseInt(process.env.LOCAL_BLOCKNUM_SKEW_TOLERANCE) : 10;


        let msg = `Config.init: DONE;`;
        clog.info(msg);
        flog.info(msg);
        
        this.isInited = true;
    }

    public display () {
        let msg=`Config.display: v0.4; gasLimit:${this.gasLimit}; isAPIGetGasPrice:${this.isAPIGetGasPrice}; gasPriceMultiplier:${this.gasPriceMultiplier}; gasPriceAdder:${this.gasPriceAdder}; gasPriceLimit:${this.gasPriceLimit};`; 
        clog.debug(msg);
        flog.debug(msg);

        msg=`Config.display: remainingFlashloanTries:${this.remainingFlashloanTries}; polygonAPIKey:${this.polygonAPIKey};`;
        clog.debug(msg);
        flog.debug(msg);

        msg=`Config.display: pollHeartbeatMSec:${this.pollHeartbeatMSec}; privateKey(partial):${this.privateKey.substring(0,6)}...; flashloanContractAddress:${this.flashloanContractAddress};`;
        clog.debug(msg);
        flog.debug(msg);

        msg=`Config.display: ALCMY: web3URL:${this.alchemyWeb3URL}; blockNumPollIntervalPattern:${this.alchemyBlockNumPollIntervalPattern}; blockNumPollEnabled:${this.alchemyBlockNumPollEnabled}; flashloanCheckEnabled:${this.alchemyFlashloanCheckEnabled};`;
        clog.debug(msg);
        flog.debug(msg);

        msg=`Config.display: QUIKN: web3URL:${this.quicknodeWeb3URL}; blockNumPollIntervalPattern:${this.quicknodeBlockNumPollIntervalPattern}; blockNumPollEnabled:${this.quicknodeBlockNumPollEnabled}; flashloanCheckEnabled:${this.quicknodeFlashloanCheckEnabled};`;
        clog.debug(msg);
        flog.debug(msg);

        msg=`Config.display: LOCAL: web3URL:${this.localWeb3URL}; blockNumPollIntervalPattern:${this.localBlockNumPollIntervalPattern}; blockNumPollEnabled:${this.localBlockNumPollEnabled}; flashloanCheckEnabled:${this.localFlashloanCheckEnabled};`;
        clog.debug(msg);
        flog.debug(msg);

        msg=`Config.display: LOCAL: blockNumSkewTolerance:${this.localBlockNumSkewTolerance};`;
        clog.debug(msg);
        flog.debug(msg);

        msg=`Config.display: isDoFlashloan:${this.isDoFlashloan}; isForceFlashloan: ${this.isForceFlashloan}; isRefreshOnce:${this.isRefreshOnce};`;
        clog.debug(msg);
        flog.debug(msg);

        let tradeTokensLogStr = "";
        for (let i = 0; i < this.tradeTokens.length; i++) {
            let aTradeToken = this.tradeTokens[i];
            tradeTokensLogStr += "[" + aTradeToken.symbol + ":" + aTradeToken.amountForSwap + "]";
            if (i != this.tradeTokens.length - 1) {
                tradeTokensLogStr += ",";
            }
        }
        msg=`Config.display: baseToken:${this.baseToken.symbol}; baseTokenLoanAmount:$${this.baseToken.amountForSwap}; tradeTokens:${tradeTokensLogStr};`; 
        clog.debug(msg);
        flog.debug(msg);
    }
}


export const PCKFLBConfig = Config.Instance;

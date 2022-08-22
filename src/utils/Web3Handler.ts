import {ethers} from "ethers";
import {PCKFLBConfig} from "../config";
import {formatTime} from "../utility";
//import {ParallelMultiTradesStrategy} from "../strategy/ParallelMultiTradesStrategy";
import {BlockNumHandler} from "./BlockNumHandler";
import * as log4js from "log4js";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
const blkNumLog = log4js.getLogger("blockNumFile");
//const blkPollLog = log4js.getLogger("blockPollFile");

class Web3Handler {
    static readonly LOCAL = "LOCAL";
    static readonly ALCMY = "ALCMY";
    static readonly QUIKN = "QUIKN";

    private static _instance: Web3Handler;

    private constructor() {
    }

    public static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public isInited:boolean = false;
    public globalHighestBlockNum:number = -1;
    public globalHighestBlockStartTime:number = -1;
    //public web3Provider:ethers.providers.StaticJsonRpcProvider;
    //public web3Signer:ethers.Wallet;

    private alchemyWeb3Provider:ethers.providers.StaticJsonRpcProvider;
    private alchemyBlockNumHandler:BlockNumHandler;

    private quicknodeWeb3Provider:ethers.providers.StaticJsonRpcProvider;
    private quicknodeBlockNumHandler:BlockNumHandler;

    private localWeb3Provider:ethers.providers.StaticJsonRpcProvider;
    private localBlockNumHandler:BlockNumHandler;

    private laggingCount:Map<string,number> = new Map();

    /*
    public alchemyPMTS:ParallelMultiTradesStrategy;
    public alchemyWeb3Provider:ethers.providers.StaticJsonRpcProvider;
    public alchemyCurrentBlockNum:number = -1;
    private alchemyCurrentBlockStartTime:number = -1;

    public quicknodePMTS:ParallelMultiTradesStrategy;
    public quicknodeWeb3Provider:ethers.providers.StaticJsonRpcProvider;
    public quicknodeCurrentBlockNum:number = -1;
    private quicknodeCurrentBlockStartTime:number = -1;

    public localPMTS:ParallelMultiTradesStrategy;
    public localWeb3Provider:ethers.providers.StaticJsonRpcProvider;
    public localCurrentBlockNum:number = -1;
    private localCurrentBlockStartTime:number = -1;

    private previousBlockEndTime:number = -1;
    */

    public init():void {
        if (this.isInited) {
            let msg = `Web3Handler.init: WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
            return;
        }
        let msg = `Web3Handler.init: START; localWeb3URL:${PCKFLBConfig.localWeb3URL}; alchemyWeb3URL:${PCKFLBConfig.alchemyWeb3URL}; quicknodeWeb3URL:${PCKFLBConfig.quicknodeWeb3URL};`;
        clog.info(msg);
        flog.info(msg);      
        
        
        if (PCKFLBConfig.localBlockNumPollEnabled) {
            //this.processBlockNumberPollPatternString(PCKFLBConfig.localBlockNumPollIntervalPattern);
            this.laggingCount.set(Web3Handler.LOCAL, 0);
            this.localWeb3Provider = new ethers.providers.StaticJsonRpcProvider(PCKFLBConfig.localWeb3URL);
            this.localBlockNumHandler = new BlockNumHandler(Web3Handler.LOCAL);
            this.localBlockNumHandler.init(this.localWeb3Provider, PCKFLBConfig.localFlashloanCheckEnabled, 0, PCKFLBConfig.localBlockNumPollIntervalPattern);
        }

        if (PCKFLBConfig.alchemyBlockNumPollEnabled) {
            //this.processBlockNumberPollPatternString(PCKFLBConfig.alchemyBlockNumPollIntervalPattern);
            this.laggingCount.set(Web3Handler.ALCMY, 0);
            this.alchemyWeb3Provider = new ethers.providers.StaticJsonRpcProvider(PCKFLBConfig.alchemyWeb3URL);
            this.alchemyBlockNumHandler = new BlockNumHandler(Web3Handler.ALCMY);
            this.alchemyBlockNumHandler.init(this.alchemyWeb3Provider, PCKFLBConfig.alchemyFlashloanCheckEnabled, 1, PCKFLBConfig.alchemyBlockNumPollIntervalPattern);
        }

        if (PCKFLBConfig.quicknodeBlockNumPollEnabled) {
            //this.processBlockNumberPollPatternString(PCKFLBConfig.quicknodeBlockNumPollIntervalPattern);
            this.laggingCount.set(Web3Handler.QUIKN, 0);
            this.quicknodeWeb3Provider = new ethers.providers.StaticJsonRpcProvider(PCKFLBConfig.quicknodeWeb3URL);
            this.quicknodeBlockNumHandler = new BlockNumHandler(Web3Handler.QUIKN);
            this.quicknodeBlockNumHandler.init(this.quicknodeWeb3Provider, PCKFLBConfig.quicknodeFlashloanCheckEnabled, 2, PCKFLBConfig.quicknodeBlockNumPollIntervalPattern);
        }

        msg = `Web3Handler.init: DONE;`;
        clog.info(msg);
        flog.info(msg);
        this.isInited = true;
    }

    /*
    public setFlashloanStrategy(strategy:Strategy) {
        this.flashloanStrategy = strategy;
    }
    */

    /*
    public getThisProviderCurrentBlockNumber(providerName:string):number {
        if (providerName == ParallelMultiTradesStrategy.ALCMY) {
            return this.alchemyCurrentBlockNum;
        } 
        return this.localCurrentBlockNum;
    }

    public getOtherProviderCurrentBlockNumber(providerName:string):number {
        if (providerName == ParallelMultiTradesStrategy.ALCMY) {
            return this.localCurrentBlockNum;
        } 
        return this.alchemyCurrentBlockNum;
    }
    */

    public getGlobalHighestBlockNumber():number {
        return this.globalHighestBlockNum;
    }

    public getGlobalHighestBlockStartTime():number {
        return this.globalHighestBlockStartTime;
    }

    public getAvailableWeb3Provider():ethers.providers.StaticJsonRpcProvider {
        return PCKFLBConfig.localBlockNumPollEnabled ? this.localWeb3Provider : this.alchemyWeb3Provider;
    }

    /*
    // returns true if the input blockNum is more recent than the previous blockNum
    private updateAlchemyBlockNum(blockNum:number, blockStartTime:number):boolean {
        let isUpdated:boolean = false;
        if (blockNum > this.alchemyCurrentBlockNum) {
            this.updatePreviousBlockEndTime(blockNum, blockStartTime);
            isUpdated = true;
            this.alchemyCurrentBlockNum = blockNum;
            this.alchemyCurrentBlockStartTime = blockStartTime;
            blkNumLog.debug(`ALCMY       |${this.alchemyCurrentBlockNum}|        |        |T[${formatTime(this.alchemyCurrentBlockStartTime)}]`);
        }
        return isUpdated;
    }

    // returns true if the input blockNum is more recent than the previous blockNum
    private updateQuicknodeBlockNum(blockNum:number, blockStartTime:number):boolean {
        let isUpdated:boolean = false;
        if (blockNum > this.quicknodeCurrentBlockNum) {
            this.updatePreviousBlockEndTime(blockNum, blockStartTime);
            isUpdated = true;
            this.quicknodeCurrentBlockNum = blockNum;
            this.quicknodeCurrentBlockStartTime = blockStartTime;
            blkNumLog.debug(`QUIKN       |        |        |${this.quicknodeCurrentBlockNum}|T[${formatTime(this.quicknodeCurrentBlockStartTime)}]`);
        }
        return isUpdated;
    }

    // returns true if the input blockNum is more recent than the previous blockNum
    private updateLocalBlockNum(blockNum:number, blockStartTime:number):boolean {
        let isUpdated:boolean = false;
        if (blockNum > this.localCurrentBlockNum) {
            this.updatePreviousBlockEndTime(blockNum, blockStartTime);
            isUpdated = true;
            this.localCurrentBlockNum = blockNum;
            this.localCurrentBlockStartTime = blockStartTime;
            blkNumLog.debug(`LOCAL       |        |${this.localCurrentBlockNum}|        |T[${formatTime(this.localCurrentBlockStartTime)}]`);
        }
        return isUpdated;
    }
    */

    // whichever (LOCAL vs ALCMY vs QUIKN) get the latest highest block number, means the previous block already end
    // thus, register its end time with the latest highest block start time
    public updateGlobalHighestBlock(instanceName:string, instanceBlockNum:number, instanceBlockStartTime:number):boolean {
        let isUpdated:boolean = false;
        
        if (instanceBlockNum > this.globalHighestBlockNum) {
            let previousBlockNum = this.globalHighestBlockNum;
            let previousBlockStartTime = this.globalHighestBlockStartTime;
            this.globalHighestBlockNum = instanceBlockNum;
            this.globalHighestBlockStartTime = instanceBlockStartTime;
            let previousBlockDurationMSec = this.globalHighestBlockStartTime - previousBlockStartTime;
            blkNumLog.debug(`new:   ${instanceName}|----${previousBlockNum}..${this.globalHighestBlockNum}----|T[${formatTime(previousBlockStartTime)}..${formatTime(this.globalHighestBlockStartTime)}]|blkDur:${previousBlockDurationMSec}|`);
        } else if (instanceBlockNum < this.globalHighestBlockNum) {
            let aLaggingCount = this.laggingCount.get(instanceName)! + 1;
            this.laggingCount.set(instanceName, aLaggingCount);
            blkNumLog.debug(`lag:   ${instanceName}|----${instanceBlockNum}<<${this.globalHighestBlockNum}----|count:${aLaggingCount}|`);
        }
        return isUpdated;
    }

    /*
    private getAlchemyBlockNum():void {
        //flog.debug(`W3H.gABN: 1.0`);
        try {
            let blkStartTime = Date.now();
            let currentBlockNumberPromise = this.alchemyWeb3Provider.getBlockNumber();
            Promise.resolve(currentBlockNumberPromise).then(async (currentBlockNumber) => {
                let blkEndTime = Date.now();
                let blkTimeDiff = (blkEndTime - blkStartTime) / 1000;
                blkPollLog.debug(`ALCMY; #[${currentBlockNumber}]; T:[${blkTimeDiff}|${formatTime(blkStartTime)}->${formatTime(blkEndTime)}];`);
                if (this.updateAlchemyBlockNum(currentBlockNumber, blkEndTime)) {
                    // this call gets the latest block number, will proceed to price check
                    flog.debug(`W3H.gABN: ALCMY; about to call PMTS.refreshAll; currentBlockNumber:${currentBlockNumber};`);
                    this.alchemyPMTS.refreshAll(currentBlockNumber, PCKFLBConfig.alchemyFlashloanCheckEnabled);
                }
            }).catch((error) => {
                flog.error(`W3H.gABN: ALCMY; ERROR - in getting currentBlockNumber promise;`);
                flog.error(error);
            });
        } catch (ex) {
            flog.error(`W3H.gABN: ALCMY; ERROR - in getting currentBlockNumber;`);
            flog.error(ex);
        }     
    }

    private getQuicknodeBlockNum():void {
        //flog.debug(`W3H.gIBN: 1.0`);
        try {
            let blkStartTime = Date.now();
            let currentBlockNumberPromise = this.quicknodeWeb3Provider.getBlockNumber();
            Promise.resolve(currentBlockNumberPromise).then(async (currentBlockNumber) => {
                let blkEndTime = Date.now();
                let blkTimeDiff = (blkEndTime - blkStartTime) / 1000;
                blkPollLog.debug(`QUIKN; #[${currentBlockNumber}]; T:[${blkTimeDiff}|${formatTime(blkStartTime)}->${formatTime(blkEndTime)}];`);                
                if (this.updateQuicknodeBlockNum(currentBlockNumber, blkEndTime)) {
                    // this call gets the latest block number, will proceed to price check
                    flog.debug(`W3H.gIBN: QUIKN; about to call PMTS.refreshAll; currentBlockNumber:${currentBlockNumber};`);
                    this.quicknodePMTS.refreshAll(currentBlockNumber, PCKFLBConfig.quicknodeFlashloanCheckEnabled);
                }
            }).catch((error) => {
                flog.error(`W3H.gIBN: QUIKN; ERROR - in getting currentBlockNumber promise;`);
                flog.error(error);
            });
        } catch (ex) {
            flog.error(`W3H.gIBN: QUIKN; ERROR - in getting currentBlockNumber;`);
            flog.error(ex);
        }     
    }

    private getLocalBlockNum():void {
        //flog.debug(`W3H.gLBN: 1.0`);
        try {
            let blkStartTime = Date.now();
            let currentBlockNumberPromise = this.localWeb3Provider.getBlockNumber();
            Promise.resolve(currentBlockNumberPromise).then(async (currentBlockNumber) => {
                let blkEndTime = Date.now();
                let blkTimeDiff = (blkEndTime - blkStartTime) / 1000;
                blkPollLog.debug(`LOCAL; #[${currentBlockNumber}]; T:[${blkTimeDiff}|${formatTime(blkStartTime)}->${formatTime(blkEndTime)}];`);
                //let [highestCurrentBlockNumber, isWinnerFromLocal] = this.getHighestCurrentBlockNumber();
                if (this.updateLocalBlockNum(currentBlockNumber, blkEndTime)) {
                    // this call gets the latest block number, will proceed to price check
                    flog.debug(`W3H.gLBN: LOCAL; about to call PMTS.refreshAll; currentBlockNumber:${currentBlockNumber};`);
                    this.localPMTS.refreshAll(currentBlockNumber, PCKFLBConfig.localFlashloanCheckEnabled);
                }
            }).catch((error) => {
                flog.error(`W3H.gLBN: LOCAL; ERROR - in getting currentBlockNumber promise;`);
                flog.error(error);
            });
        } catch (ex) {
            flog.error(`W3H.gLBN: LOCAL; ERROR - in getting currentBlockNumber;`);
            flog.error(ex);
        }     
    }
    */

}

export const PCKWeb3Handler = Web3Handler.Instance;
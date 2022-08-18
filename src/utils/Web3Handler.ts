import {ethers} from "ethers";
import {PCKFLBConfig} from "../config";
import {formatTime} from "../utility";
import {ParallelMultiTradesStrategy} from "../strategy/ParallelMultiTradesStrategy";
import * as log4js from "log4js";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
const blkNumLog = log4js.getLogger("blockNumFile");
const blkPollLog = log4js.getLogger("blockPollFile");

class Web3Handler {
    private static _instance: Web3Handler;

    private constructor() {
    }

    public static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public isInited:boolean = false;
    //public web3Provider:ethers.providers.StaticJsonRpcProvider;
    //public web3Signer:ethers.Wallet;
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

    public init():void {
        if (this.isInited) {
            let msg = `Web3Handler.init: WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
            return;
        }
        let msg = `Web3Handler.init: START; alchemyWeb3URL:${PCKFLBConfig.alchemyWeb3URL}; localWeb3URL:${PCKFLBConfig.localWeb3URL};`;
        clog.info(msg);
        flog.info(msg);        

        if (PCKFLBConfig.alchemyBlockNumPollEnabled) {
            this.alchemyPMTS = new ParallelMultiTradesStrategy(ParallelMultiTradesStrategy.ALCMY);
            this.alchemyWeb3Provider = new ethers.providers.StaticJsonRpcProvider(PCKFLBConfig.alchemyWeb3URL);
            this.alchemyPMTS.init(this.alchemyWeb3Provider);
            setInterval(() => {this.getAlchemyBlockNum()}, PCKFLBConfig.alchemyBlockNumPollIntervalMsec);
        }

        if (PCKFLBConfig.quicknodeBlockNumPollEnabled) {
            this.quicknodePMTS = new ParallelMultiTradesStrategy(ParallelMultiTradesStrategy.QUIKN);
            this.quicknodeWeb3Provider = new ethers.providers.StaticJsonRpcProvider(PCKFLBConfig.quicknodeWeb3URL);
            this.quicknodePMTS.init(this.quicknodeWeb3Provider);
            setInterval(() => {this.getQuicknodeBlockNum()}, PCKFLBConfig.quicknodeBlockNumPollIntervalMsec);
        }

        if (PCKFLBConfig.localBlockNumPollEnabled) {
            this.localPMTS = new ParallelMultiTradesStrategy(ParallelMultiTradesStrategy.LOCAL);
            this.localWeb3Provider = new ethers.providers.StaticJsonRpcProvider(PCKFLBConfig.localWeb3URL);
            this.localPMTS.init(this.localWeb3Provider);
            setInterval(() => {this.getLocalBlockNum()}, PCKFLBConfig.localBlockNumPollIntervalMsec);
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

    public getHighestBlockNumber():number {
        let highestBlockNumber = this.localCurrentBlockNum >= this.alchemyCurrentBlockNum ? this.localCurrentBlockNum : this.alchemyCurrentBlockNum;
        return this.quicknodeCurrentBlockNum >= highestBlockNumber ? this.quicknodeCurrentBlockNum : highestBlockNumber;
    }

    public getAvailableWeb3Provider():ethers.providers.StaticJsonRpcProvider {
        return this.localCurrentBlockNum >= this.alchemyCurrentBlockNum ? this.localWeb3Provider : this.alchemyWeb3Provider;
    }

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

    // whichever (LOCAL vs ALCMY) get the latest highest block number, means the previous block already end
    // thus, register its end time with the latest highest block start time
    private updatePreviousBlockEndTime(highestInstanceBlockNum:number, highestInstanceBlockStartTime:number):boolean {
        let isUpdated:boolean = false;
        let highestBlockNumber = this.getHighestBlockNumber();
        if (highestInstanceBlockNum > highestBlockNumber) {
            let previousPreviousBlockEndTime = this.previousBlockEndTime;
            this.previousBlockEndTime = highestInstanceBlockStartTime;
            let previousBlockDuration = ((this.previousBlockEndTime - previousPreviousBlockEndTime) / 1000).toFixed(3);
            blkNumLog.debug(`END@${highestBlockNumber}|        |        |        |T[${formatTime(previousPreviousBlockEndTime)}..${formatTime(this.previousBlockEndTime)}]|blkDur:${previousBlockDuration}|`);
        }
        return isUpdated;
    }

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

}

export const PCKWeb3Handler = Web3Handler.Instance;
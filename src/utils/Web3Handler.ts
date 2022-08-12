import {ethers} from "ethers";
import {PCKFLBConfig} from "../config";
import {formatTime} from "../utility";
import {ParallelMultiTradesStrategy} from "../strategy/ParallelMultiTradesStrategy";
import * as log4js from "log4js";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
const blkNumLog = log4js.getLogger("blockNumFile");

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
    public alchemyWeb3Signer:ethers.Wallet;
    public alchemyCurrentBlockNum:number = -1;
    private alchemyCurrentBlockStartTime:number = -1;

    public localPMTS:ParallelMultiTradesStrategy;
    public localWeb3Provider:ethers.providers.StaticJsonRpcProvider;
    public localWeb3Signer:ethers.Wallet;
    public localCurrentBlockNum:number = -1;
    private localCurrentBlockStartTime:number = -1;


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

        this.alchemyPMTS = new ParallelMultiTradesStrategy(ParallelMultiTradesStrategy.ALCMY);
        this.alchemyWeb3Provider = new ethers.providers.StaticJsonRpcProvider(PCKFLBConfig.alchemyWeb3URL);
        this.alchemyWeb3Signer = new ethers.Wallet(PCKFLBConfig.privateKey, this.alchemyWeb3Provider);
        this.alchemyPMTS.init(this.alchemyWeb3Provider);

        this.localPMTS = new ParallelMultiTradesStrategy(ParallelMultiTradesStrategy.LOCAL);
        this.localWeb3Provider = new ethers.providers.StaticJsonRpcProvider(PCKFLBConfig.localWeb3URL);
        this.localWeb3Signer = new ethers.Wallet(PCKFLBConfig.privateKey, this.localWeb3Provider);
        this.localPMTS.init(this.localWeb3Provider);

        if (PCKFLBConfig.alchemyBlockNumPollEnabled) {
            setInterval(() => {this.getAlchemyBlockNum()}, PCKFLBConfig.alchemyBlockNumPollIntervalMsec);
        }

        if (PCKFLBConfig.localBlockNumPollEnabled) {
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

    public getHighestCurrentBlockNumber():number {
        return this.localCurrentBlockNum >= this.alchemyCurrentBlockNum ? this.localCurrentBlockNum : this.alchemyCurrentBlockNum;
    }

    public getAvailableWeb3Provider():ethers.providers.StaticJsonRpcProvider {
        return this.localCurrentBlockNum >= this.alchemyCurrentBlockNum ? this.localWeb3Provider : this.alchemyWeb3Provider;
    }

    // returns true if the input blockNum is more recent than the previous blockNum
    private updateAlchemyBlockNum(blockNum:number, blockStartTime:number):boolean {
        let isUpdated:boolean = false;
        if (blockNum > this.alchemyCurrentBlockNum) {
            isUpdated = true;
            this.alchemyCurrentBlockNum = blockNum;
            this.alchemyCurrentBlockStartTime = blockStartTime;
            blkNumLog.debug(`ALCMY|@[${this.alchemyCurrentBlockNum}]|T[${formatTime(this.alchemyCurrentBlockStartTime)}]`);
        }
        return isUpdated;
    }

    // returns true if the input blockNum is more recent than the previous blockNum
    private updateLocalBlockNum(blockNum:number, blockStartTime:number):boolean {
        let isUpdated:boolean = false;
        if (blockNum > this.localCurrentBlockNum) {
            isUpdated = true;
            this.localCurrentBlockNum = blockNum;
            this.localCurrentBlockStartTime = blockStartTime;
            blkNumLog.debug(`LOCAL|@[${this.localCurrentBlockNum}]|T[${formatTime(this.localCurrentBlockStartTime)}]`);
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
                flog.debug(`W3H.gABN: ALCMY; crntBlk#:[${currentBlockNumber}]; T:[${blkTimeDiff}|${formatTime(blkStartTime)}->${formatTime(blkEndTime)}];`);
                //let [highestCurrentBlockNumber, isWinnerFromLocal] = this.getHighestCurrentBlockNumber();
                if (this.updateAlchemyBlockNum(currentBlockNumber, blkStartTime)) {
                    // this call gets the latest block number, will proceed to price check
                    flog.debug(`W3H.gABN: ALCMY; about to call PMTS.refreshAll; currentBlockNumber:${currentBlockNumber};`);
                    this.alchemyPMTS.refreshAll(currentBlockNumber);
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

    private getLocalBlockNum():void {
        //flog.debug(`W3H.gLBN: 1.0`);
        try {
            let blkStartTime = Date.now();
            let currentBlockNumberPromise = this.localWeb3Provider.getBlockNumber();
            Promise.resolve(currentBlockNumberPromise).then(async (currentBlockNumber) => {
                let blkEndTime = Date.now();
                let blkTimeDiff = (blkEndTime - blkStartTime) / 1000;
                flog.debug(`W3H.gLBN: LOCAL; crntBlk#:[${currentBlockNumber}]; T:[${blkTimeDiff}|${formatTime(blkStartTime)}->${formatTime(blkEndTime)}];`);
                //let [highestCurrentBlockNumber, isWinnerFromLocal] = this.getHighestCurrentBlockNumber();
                if (this.updateLocalBlockNum(currentBlockNumber, blkStartTime)) {
                    // this call gets the latest block number, will proceed to price check
                    flog.debug(`W3H.gLBN: LOCAL; about to call PMTS.refreshAll; currentBlockNumber:${currentBlockNumber};`);
                    this.localPMTS.refreshAll(currentBlockNumber);
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
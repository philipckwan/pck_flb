import {ethers} from "ethers";
import {PCKFLBConfig} from "../config";
import {formatTime} from "../utility";
import {PCKWeb3Handler} from "./Web3Handler";
import {ParallelMultiTradesStrategy} from "../strategy/ParallelMultiTradesStrategy";
import * as log4js from "log4js";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
const blkNumLog = log4js.getLogger("blockNumFile");
const blkPollLog = log4js.getLogger("blockPollFile");

export class BlockNumHandler {
    private name:string;

    public constructor(name:string) {
        this.name = name;
    }

    private isInited:boolean = false;
    private isBusy:boolean = false;
    private pmts:ParallelMultiTradesStrategy;
    private web3Provider:ethers.providers.StaticJsonRpcProvider;
    public highestBlockNum:number = -1;
    public highestBlockStartTime:number = -1;
    private displayLeft:string = "";
    private displayRight:string = "";

    private pollIntervalTable:number[][] = [];
    private nextBlockCheckTime:number = -1;

    public init(web3Provider:ethers.providers.StaticJsonRpcProvider, isInstanceDoFlashloan:boolean, displayColumnIdx:number, pollIntervalPattern:string) {
        let msg = "";
        if (this.isInited) {
            msg = `BNH.init: [${this.name}] WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
        }

        msg = `BNH.init: [${this.name}]; START;`;
        clog.info(msg);
        flog.info(msg);
        
        this.pmts = new ParallelMultiTradesStrategy(this.name);
        this.web3Provider = web3Provider;
        for (let i = 0; i < displayColumnIdx; i++) {
            this.displayLeft += "        |";
        }
        for (let i = displayColumnIdx; i < 2; i++) {
            this.displayRight += "|        ";
        }
        this.pmts.init(this.web3Provider, isInstanceDoFlashloan, this);
        setInterval(() => {this.pollBlockNum()}, PCKFLBConfig.pollHeartbeatMSec);

        msg = `BNH.init: [${this.name}]; displayLeft:[${this.displayLeft}]; displayRight:[${this.displayRight}];`;
        flog.info(msg);

        this.processPollIntervalPattern(pollIntervalPattern);
        /*
        let currentTDiff:number;
        currentTDiff = 0;
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);

        currentTDiff = 1;
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);

        currentTDiff = 1499;
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);

        currentTDiff = 1500;
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);

        currentTDiff = 1501;
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);

        currentTDiff = 1799;
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);

        currentTDiff = 1800;
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);

        currentTDiff = 2000;
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);

        currentTDiff = 2200;
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);

        currentTDiff = 2500;
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);

        currentTDiff = Date.now();
        console.log(`__getNextPollTOffset(${currentTDiff})=${this.getNextPollTOffset(currentTDiff)};`);
        //*/
        msg = `BNH.init: [${this.name}]; DONE;`;
        clog.info(msg);
        flog.info(msg);
        this.isInited = true;
    }

    private pollBlockNum():void {
        //flog.debug(`BNH.poll: 1.0`);
        if (this.isBusy) {
            blkPollLog.debug(`${this.name}; isBusy:${this.isBusy}; will skip poll;`);
        }
        this.isBusy = true;
        try {
            let blockCheckStartTime = Date.now();
            if (blockCheckStartTime < this.nextBlockCheckTime){
                //blkPollLog.debug(`${this.name}; not yet time to poll, [${formatTime(blockCheckStartTime)}] < [${formatTime(this.nextBlockCheckTime)}];`);
                this.isBusy = false;
                return;
            }
            let currentBlockNumberPromise = this.web3Provider.getBlockNumber();
            let currentTDiff = blockCheckStartTime - this.highestBlockStartTime;
            this.nextBlockCheckTime = blockCheckStartTime + this.getNextPollTOffset(currentTDiff);
            //console.log(`____blockCheckStartTime:${blockCheckStartTime}; highestBlockStartTime:${this.highestBlockStartTime}; currentTDiff:${currentTDiff}; nextBlockCheckTime:${this.nextBlockCheckTime};`);
            Promise.resolve(currentBlockNumberPromise).then(async (currentBlockNumber) => {
                let blockCheckEndTime = Date.now();
                let blockCheckTimeDiffMSec = blockCheckEndTime - blockCheckStartTime;
                blkPollLog.debug(`${this.name}; #[${currentBlockNumber}]; T:[${blockCheckTimeDiffMSec.toString().padStart(5)}|${formatTime(blockCheckStartTime)}->${formatTime(blockCheckEndTime)}];`);
                
                if (this.updateBlockNum(currentBlockNumber, blockCheckEndTime)) {
                    // this call gets the latest block number, may proceed to price check
                    flog.debug(`BNH.poll: ${this.name}; #[${currentBlockNumber}]; about to call PMTS.refreshAll;`);
                    this.pmts.refreshAll(currentBlockNumber);
                }
                this.isBusy = false;
            }).catch((_error) => {
                blkPollLog.error(`${this.name}; ERROR - in getting currentBlockNumber promise;`);
                //flog.error(error);
            });
        } catch (_ex) {
            blkPollLog.error(`${this.name}; ERROR - in getting currentBlockNumber;`);
            //flog.error(ex);
        }     
        this.isBusy = false;
    }

    // returns true if the input blockNum is more recent than the previous blockNum
    private updateBlockNum(blockNum:number, blockStartTime:number):boolean {
        let isUpdated:boolean = false;
        if (blockNum > this.highestBlockNum) {
            PCKWeb3Handler.updateGlobalHighestBlock(this.name, blockNum, blockStartTime);
            isUpdated = true;
            this.highestBlockNum = blockNum;
            this.highestBlockStartTime = blockStartTime;
            blkNumLog.debug(`${this.name}       |${this.displayLeft}${this.highestBlockNum}${this.displayRight}|T[${formatTime(this.highestBlockStartTime)}]`);
        }
        return isUpdated;
    }

    private processPollIntervalPattern(patternStr:string):void {
        //console.log(`++pattern:[${patternStr}]`);
        patternStr = `${patternStr}@`;
        /*
         Given:
         ";400@1500;100@1800;20@2200;100@2500;200@"
         ";x@" -> x is the stage poll interval
         */
        let arraySplitBySemiColon = patternStr.split(";");
        for (let i = 0; i < arraySplitBySemiColon.length; i++) {
            let aStagePollIntervalStr = arraySplitBySemiColon[i];
            let aStagePollInterval = parseInt(aStagePollIntervalStr.substring(0, aStagePollIntervalStr.indexOf("@")));
            //console.log(`__aStagePollInterval [${this.name}]:[${aStagePollInterval}];`);
            let aStagePollTill = parseInt(aStagePollIntervalStr.substring(aStagePollIntervalStr.indexOf("@") + 1));
            if (isNaN(aStagePollTill)) {
                aStagePollTill = Number.MAX_SAFE_INTEGER;
            }
            //console.log(`++[${this.name}]:[${aStagePollTill},${aStagePollInterval}];`);
            this.pollIntervalTable.push([aStagePollTill, aStagePollInterval]);
        }
        let msg = `BNH.processPollIntervalPattern[${this.name}]:`;
        for (let i = 0; i < this.pollIntervalTable.length; i++) {
            msg += `[${this.pollIntervalTable[i][0]}, ${this.pollIntervalTable[i][1]}] `
        }
        console.log(msg);
    }

    
    private getNextPollTOffset(currentTDiff:number):number {
        for(let i = 0; i < this.pollIntervalTable.length; i++) {
            if (currentTDiff < this.pollIntervalTable[i][0]) {
                return this.pollIntervalTable[i][1];
            }
        }
        return this.pollIntervalTable[this.pollIntervalTable.length - 1][1];
    }

}
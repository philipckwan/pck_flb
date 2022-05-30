import * as log4js from "log4js";
const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
import {ITwoSwaps, ISwapPairRoutes, IRouterToAmount, IToAmountAndRate, ISwapRoutes, ISwap} from "../interfaces";
import {BigNumber, ethers} from "ethers";
import {getSwapAmountAndRate} from "../uniswap/uniswapPrice"
import {PCKFlashloanExecutor} from "../flashloan/FlashloanExecutor";
import {PCKFLBConfig} from "../config";
import {Strategy} from "./Strategy";
import {getBigNumber} from "../utility";



export class ParallelTwoSwapsStrategy extends Strategy {

    public constructor(aVersion:ParallelTwoSwapsStrategy.VERSION) {
        super("ParallelTwoSwapsStrategy");
        this.version = aVersion;
    }

    public twoSwapsArray:ITwoSwaps[] = [];
    public isBusy = false;
    private latestRateThreshold = 1.001;
    //private swapRoutesList:ISwapRoutes[];
    private version:ParallelTwoSwapsStrategy.VERSION = ParallelTwoSwapsStrategy.VERSION.V1;

    /*
    public init(aSwapRoutesList:ISwapRoutes[]) {
        if (this.isInited) {
            let msg = `PTSS.init: WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
        }
        this.swapRoutesList = aSwapRoutesList;
        let msg = `ParallelTwoSwapsStrategy(PTSS).init: v0.1; DONE;`;
        clog.info(msg);
        flog.info(msg);

        this.isInited = true;
    }
    */

    public display():void {
        flog.debug(`PTSS.display: version:${ParallelTwoSwapsStrategy.VERSION[this.version]};`)
        super.display();
    }

    public refreshAll():void {

    }

    public async initTwoSwapsArray(aSwapPairList:ISwapRoutes[]) {
        flog.debug(`PTSS.initTwoSwapsArray: 1.0;`)
        for (let i = 0; i < aSwapPairList.length; i++) {
            let aSwapRoutes = aSwapPairList[i];
            let bnLoanAmountUSDx = getBigNumber(PCKFLBConfig.loanAmountUSDx, aSwapRoutes.swapPairRoutes[0].fromToken.decimals);
            await this.addSwapPair(aSwapRoutes.swapPairRoutes[0], aSwapRoutes.swapPairRoutes[1], bnLoanAmountUSDx);
            this.printSwapPair(i);
        }
    }

    private async addSwapPair(aFromSwap:ISwapPairRoutes, aToSwap:ISwapPairRoutes, fromSwapFromAmount:BigNumber) {
        let aTwoSwaps:ITwoSwaps = {
            fromSwap:aFromSwap,
            fromWinnerIdx:0,
            toSwap:aToSwap,
            toWinnerIdx:0
        }

        flog.debug(`PTSS.addSwapPair: initializing fromSwap...`);
        aTwoSwaps.fromSwap.fromAmount = fromSwapFromAmount;
        for (let i = 0; i < aTwoSwaps.fromSwap.routerToAmountList.length; i++) {
            let aRouteToAmount = aTwoSwaps.fromSwap.routerToAmountList[i];
            try {
              let amountAndRate = await getSwapAmountAndRate(aTwoSwaps.fromSwap.fromToken, aTwoSwaps.fromSwap.toToken, aRouteToAmount.router, aTwoSwaps.fromSwap.fromAmount);
              aRouteToAmount.toFromRate = amountAndRate.toFromRate;
              aRouteToAmount.toAmount = amountAndRate.toAmount;             
            } catch (e) {
              flog.error(`PTSS.addSwapPair: ERROR - 1;`);
              aRouteToAmount.toFromRate = 0;
            } 
        }
        aTwoSwaps.fromWinnerIdx = this.findWinnerIdx(aTwoSwaps.fromSwap.routerToAmountList);

        flog.debug(`PTSS.addSwapPair: initializing toSwap...`);
        aTwoSwaps.toSwap.fromAmount = aTwoSwaps.fromSwap.routerToAmountList[aTwoSwaps.fromWinnerIdx].toAmount;
        for (let i = 0; i < aTwoSwaps.toSwap.routerToAmountList.length; i++) {
            let aRouteToAmount = aTwoSwaps.toSwap.routerToAmountList[i];
            try {
              let amountAndRate = await getSwapAmountAndRate(aTwoSwaps.toSwap.fromToken, aTwoSwaps.toSwap.toToken, aRouteToAmount.router, aTwoSwaps.toSwap.fromAmount);
              aRouteToAmount.toFromRate = amountAndRate.toFromRate;
              aRouteToAmount.toAmount = amountAndRate.toAmount;             
            } catch (e) {
              flog.error(`PTSS.addSwapPair: ERROR - 2;`);
              aRouteToAmount.toFromRate = 0;
            } 
        }
        aTwoSwaps.toWinnerIdx = this.findWinnerIdx(aTwoSwaps.toSwap.routerToAmountList);
        this.twoSwapsArray.push(aTwoSwaps);
    }

    public async refresh(idx:number){
        flog.debug(`PTSS.refresh: START; idx:${idx};`);
        this.isBusy = true;
        let aTwoSwaps = this.twoSwapsArray[idx];

        let fromSwapPromises = [];
        for (let aRTA of aTwoSwaps.fromSwap.routerToAmountList) {
            let promANewAmountAndRate = getSwapAmountAndRate(aTwoSwaps.fromSwap.fromToken, aTwoSwaps.fromSwap.toToken, aRTA.router, aTwoSwaps.fromSwap.fromAmount);
            fromSwapPromises.push(promANewAmountAndRate);
        }
        Promise.all(fromSwapPromises).then((newAmountAndRates) => {
            let fromMaxRate = 0;
            let fromWinnerIdx = 0;
            for (let i = 0; i < newAmountAndRates.length; i++) {
                let aNewAmountAndRate = newAmountAndRates[i];
                flog.debug(`PTSS.refresh: fromSwap: aNAAR[${i}].toFromRate:${aNewAmountAndRate.toFromRate.toFixed(6)};`);
                if (aNewAmountAndRate.toFromRate > fromMaxRate) {
                    fromWinnerIdx = i;
                    fromMaxRate = aNewAmountAndRate.toFromRate;
                }
            }
            flog.debug(`PTSS.refresh: fromSwap: fromWinnerIdx:${fromWinnerIdx}; fromMaxRate:${fromMaxRate.toFixed(6)};`);
            let toSwapPromises = [];
            for (let aRTA of aTwoSwaps.toSwap.routerToAmountList) {
                let promANewAmountAndRate = getSwapAmountAndRate(aTwoSwaps.toSwap.fromToken, aTwoSwaps.toSwap.toToken, aRTA.router, aTwoSwaps.toSwap.fromAmount);
                toSwapPromises.push(promANewAmountAndRate);
            }
            Promise.all(toSwapPromises).then(async (newAmountAndRates) => {
                let toMaxRate = 0;
                let toWinnerIdx = 0;
                for (let i = 0; i < newAmountAndRates.length; i++) {
                    let aNewAmountAndRate = newAmountAndRates[i];
                    flog.debug(`PTSS.refresh: toSwap: aNAAR[${i}].toFromRate:${aNewAmountAndRate.toFromRate.toFixed(6)};`);
                    if (aNewAmountAndRate.toFromRate > toMaxRate) {
                        toWinnerIdx = i;
                        toMaxRate = aNewAmountAndRate.toFromRate;
                    }
                }
                flog.debug(`PTSS.refresh: toSwap: toWinnerIdx:${toWinnerIdx}; toMaxRate:${toMaxRate.toFixed(6)};`);

                let newFinalRate = fromMaxRate * toMaxRate;
                let isOpp = newFinalRate > this.latestRateThreshold;
                flog.debug(`PTSS.refresh: isOpp:${isOpp}; newFinalRate:${newFinalRate.toFixed(6)}; fromWinnerIdx:${fromWinnerIdx}; toWinnerIdx:${toWinnerIdx};`);

                if (isOpp) {
                    if (PCKFLBConfig.remainingFlashloanTries > 0) {
                        flog.debug(`PTSS.refresh: will execute flashloan...`);
                        let results = await PCKFlashloanExecutor.executeFlashloanPair(aTwoSwaps.fromSwap, fromWinnerIdx, aTwoSwaps.toSwap, toWinnerIdx);
                        PCKFLBConfig.remainingFlashloanTries--;
                        flog.debug(`PTSS.refresh: flashloan executed, results=${results}; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
                    }   else {
                        flog.debug(`PTSS.refresh: will not execute flashloan; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
                    }
                }
                this.isBusy = false;
            });
        });

    }

    public getFinalRate(idx:number):number {
        let finalRate = 0;
        finalRate = this.twoSwapsArray[idx].fromSwap.routerToAmountList[this.twoSwapsArray[idx].fromWinnerIdx].toFromRate * this.twoSwapsArray[idx].toSwap.routerToAmountList[this.twoSwapsArray[idx].toWinnerIdx].toFromRate;
        return finalRate;
    }

    private findWinnerIdx(RTAs:IRouterToAmount[]):number {
        let winnerIdx = -1;
        let maxRate = 0;
        for (let i = 0; i < RTAs.length; i++) {
            if (RTAs[i].toFromRate > maxRate) {
                maxRate = RTAs[i].toFromRate;
                winnerIdx = i;
            }
        }
        return winnerIdx;
    }

    public printSwapPair(idx:number) {
        let aTwoSwaps = this.twoSwapsArray[idx];
        flog.debug(`PTSS.printTwoSwaps: START;`);
        let nFromAmount = Number(ethers.utils.formatUnits(aTwoSwaps.fromSwap.fromAmount, aTwoSwaps.fromSwap.fromToken.decimals));
        flog.debug(`_fromSwap:[${aTwoSwaps.fromSwap.fromToken.symbol}->${aTwoSwaps.fromSwap.toToken.symbol}]; $:${nFromAmount.toFixed(4)}; fw:${aTwoSwaps.fromWinnerIdx};`);
        for (let i = 0; i < aTwoSwaps.fromSwap.routerToAmountList.length; i++) {
            let aRTA = aTwoSwaps.fromSwap.routerToAmountList[i];
            let nToAmount = Number(ethers.utils.formatUnits(aRTA.toAmount, aTwoSwaps.fromSwap.toToken.decimals));
            let msg = `__@:${aRTA.router.name.padStart(18)}; $:${nToAmount.toFixed(4).padStart(10)}; %:${aRTA.toFromRate.toFixed(8)};`;
            if (i == aTwoSwaps.fromWinnerIdx) {
                msg += `<--winner;`;
            }
            flog.debug(msg);
        }
        nFromAmount = Number(ethers.utils.formatUnits(aTwoSwaps.toSwap.fromAmount, aTwoSwaps.toSwap.fromToken.decimals));
        flog.debug(`_toSwap:[${aTwoSwaps.toSwap.fromToken.symbol}->${aTwoSwaps.toSwap.toToken.symbol}]; $:${nFromAmount.toFixed(4)}; tw:${aTwoSwaps.toWinnerIdx};`);
        for (let i = 0; i < aTwoSwaps.toSwap.routerToAmountList.length; i++) {
            let aRTA = aTwoSwaps.toSwap.routerToAmountList[i];
            let nToAmount = Number(ethers.utils.formatUnits(aRTA.toAmount, aTwoSwaps.toSwap.toToken.decimals));
            let msg = `__@:${aRTA.router.name.padStart(18)}; $:${nToAmount.toFixed(4).padStart(10)}; %:${aRTA.toFromRate.toFixed(8)};`;
            if (i == aTwoSwaps.toWinnerIdx) {
                msg += `<--winner;`;
            }
            flog.debug(msg);
        }
        flog.debug(`PTSS.printTwoSwaps: END; finalRate:${this.getFinalRate(idx)};`);
    }

}
//export const PCKParallelTwoSwapsStrategy = ParallelTwoSwapsStrategy.Instance;
export namespace ParallelTwoSwapsStrategy {
    export enum VERSION {V1, V2}
}
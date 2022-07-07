import * as log4js from "log4js";
const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
import {ITwoSwaps, ISwapPairRoutes, IRouterToAmount, IToRate, ISwapRoutes, ISwap, IToken, ItfHop, IRouter, ItfTrade} from "../interfaces";
import {BigNumber, ethers} from "ethers";
import {getSwapRateByHop} from "../uniswap/uniswapPrice"
import {PCKFlashloanExecutor} from "../flashloan/FlashloanExecutor";
import {PCKFLBConfig} from "../config";
import {Strategy} from "./Strategy";
import {getBigNumber, formatTime} from "../utility";
import {ERC20_TOKEN, SWAP_ROUTER} from "../addresses";



export class ParallelMultiTradesStrategy extends Strategy {
    public initTwoSwapsArray(aSwapPairList: ISwapRoutes[]): void {
        throw new Error(`Method not implemented. aSwapPairList.length:${aSwapPairList.length};`);
    }
    public printSwapPair(idx: number): void {
        throw new Error(`Method not implemented. idx:${idx};`);
    }

    public constructor() {
        super("ParallelMultiTradesStrategy");
    }

    //public twoSwapsArray:ITwoSwaps[] = [];
    public isBusy = false;
    private isProfitRate = 1.001;
    private previousFlashloanExecutedRate = 0;
    //private trades:
    private swapPairs = new Map<string,ItfHop>();
    private trades:ItfTrade[] = [];

    public display():void {
        //flog.debug(`PMTS.display: 1.0;`)
        super.display();
    }

    public init() {
        flog.debug(`PMTS.init: 1.0;`);
        // create the swapPairs
        // first, the baseToken to each tradeToken
        // then, each tradeToken with each other
        let allTokens:IToken[] = [];
        allTokens.push(PCKFLBConfig.baseToken);
        for (let aTradeToken of PCKFLBConfig.tradeTokens) {
            allTokens.push(aTradeToken);
        }

        for (let i = 0; i < allTokens.length; i++) {
            let aToken = allTokens[i];
            for (let j = 0; j < allTokens.length; j++) {
                if (i == j) {
                    continue;
                }
                let bToken = allTokens[j];
                let aSwapPair:ItfHop = {
                    tokenFrom: aToken,
                    tokenTo: bToken,
                    swapRouter:{
                        name:"",
                        address:"",
                        protocol:-1
                    },
                    maxRate: 0
                }
                let swapPairKey = `${aToken.symbol}-${bToken.symbol}`;
                this.swapPairs.set(swapPairKey, aSwapPair);
            }
        }
        //this.printSwapPairs();

        // create the trades
        let tradeTokenSymbols = [];
        for (let i = 0; i < PCKFLBConfig.tradeTokens.length; i++) {
            tradeTokenSymbols.push(PCKFLBConfig.tradeTokens[i].symbol);
        }
        let tokenSymbolsPermutations:string[][] = this.generatePermutations(tradeTokenSymbols);
        //this.printPermutations(tokenSymbolsPermutations);

        this.trades = this.generateTrades(tokenSymbolsPermutations);
        //this.printTrades();
    }

    private generateTrades(tokensPermutations:string[][]):ItfTrade[] {
        // convert tokensPermutations to ItfTrade
        // wrap all permutations with the baseToken in first and last swap
        let results:ItfTrade[] = [];
        for (let i = 0; i < tokensPermutations.length; i++) {
            let aPermutation = tokensPermutations[i];
            let thisHops:ItfHop[] = [];
            for (let j = 0; j < aPermutation.length; j++) {
                let aTokenSymbol = aPermutation[j];
                let swapPairKey = null;
                let thisSwapPair = null;
                if (j == 0) {
                    swapPairKey = `${PCKFLBConfig.baseToken.symbol}-${aTokenSymbol}`;
                    thisSwapPair = this.swapPairs.get(swapPairKey)!;
                    thisHops.push(thisSwapPair);
                } 
                if (j + 1 < aPermutation.length) {
                    let bTokenSymbol = aPermutation[j+1];
                    swapPairKey = `${aTokenSymbol}-${bTokenSymbol}`;
                    thisSwapPair = this.swapPairs.get(swapPairKey)!;
                    thisHops.push(thisSwapPair);
                }
                if (j == aPermutation.length - 1) {
                    swapPairKey = `${aTokenSymbol}-${PCKFLBConfig.baseToken.symbol}`;
                    thisSwapPair = this.swapPairs.get(swapPairKey)!;
                    thisHops.push(thisSwapPair);
                }
            }
            let thisTrade:ItfTrade = {
                hops: thisHops
            }
            results.push(thisTrade);
        }
        return results;
    }

    private generatePermutations(tokens:string[]):string[][]{
        /*
         e.g.) input: [A,B]
               results:[[A],[B],[A][B],[B][A]]
         */
        let results:string[][] = [];
        results = this.generatePermutationsRecursive(tokens, [], results);
        return results;
    }

    private generatePermutationsRecursive(tokens:string[], thisArray:string[], results:string[][]):string[][] {
        for (let i = 0; i < tokens.length; i++) {
            let aToken = tokens[i];
            let thisArrayCopy = thisArray.map((x) => x);
            thisArrayCopy.push(aToken);
            results.push(thisArrayCopy);
            let tokensCopy = tokens.map((x) => x);
            tokensCopy.splice(i, 1);
            results = this.generatePermutationsRecursive(tokensCopy, thisArrayCopy, results);
        }
        return results;
    }

    private printTrades() {
        flog.debug(`printTrades: trades.length:${this.trades.length};`);
        for (let i = 0; i < this.trades.length; i++) {
            let aHops = this.trades[i].hops;
            let msg = "__aHop:";
            for (let j = 0; j < aHops.length; j++) {
                let aHop = aHops[j];
                msg += `[${aHop.tokenFrom.symbol}-${aHop.tokenTo.symbol}] `
                //flog.debug(`__aHop:`)
            }
            flog.debug(msg);
        }
    }

    private printPermutations(perm:string[][]) {
        flog.debug(`printPermutations: length:${perm.length};`);
        for (let i = 0; i < perm.length; i++) {
            let aTrade = perm[i];
            let msg:string = "__aTrade:";
            for (let j = 0; j < aTrade.length; j++) {
                msg += `[${aTrade[j]}]`;
            }
            msg+=";";
            flog.debug(msg);
        }
    }

    private printSwapPairs() {
        flog.debug(`PMTS.printSwapPairs: 1.0;`);
        for (const [key, value] of this.swapPairs) {
            flog.debug(`__[${key}]: [${JSON.stringify(value)}];`);
        }
    }

    public refreshAll():void {
        if (this.isBusy) {
            flog.debug(`PMTS.refreshAll: isBusy:${this.isBusy}; skipping this refresh check...`);
            return;
        }
        this.isBusy = true;
        let startTime = Date.now();

        // for all swapPairs, refresh the rates and populate each's maximum return rate
        let allSwapPairPromises = [];
        //flog.debug(`PMTS.refreshAll: swapPairs.size:${this.swapPairs.size};`);
        for (let aSwapPair of this.swapPairs.values()){
            for (let aSwapRouter of PCKFLBConfig.routers) {
                let aPromiseSwapRate = getSwapRateByHop(aSwapPair, aSwapRouter);
                allSwapPairPromises.push(aPromiseSwapRate);
            }
        }
        for (let aSwapPair of this.swapPairs.values()) {
            aSwapPair.maxRate = 0;
        }
        Promise.all(allSwapPairPromises).then(async (resultsHopAndRates) => {
            //flog.debug(`PMTS.refreshAll: resultsHopAndRates.length:${resultsHopAndRates.length};`);
            for (let i = 0; i < resultsHopAndRates.length; i++) {
                let [hop, rate] = resultsHopAndRates[i];
                let swapPairKey = `${hop.tokenFrom.symbol}-${hop.tokenTo.symbol}`;
                let thisHop = this.swapPairs.get(swapPairKey)!;
                if (rate.toFromRate > thisHop.maxRate) {
                    thisHop.maxRate = rate.toFromRate;
                    thisHop.swapRouter = rate.router;
                }
            }
            let endTime = Date.now();
            let timeDiff = (endTime - startTime) / 1000;
            flog.debug(`PMTS.refreshAll: all swapPairs price check done; T:[${timeDiff}|${formatTime(startTime)}->${formatTime(endTime)}];`);
            /*
            for all trades, look into their corresponding pairs, multiply up the rates to get the final rates
            for one or more trades that has final rates > 1 (or the threshold say 1.001), they are flashloan opportunities
            pick the trade with the highest profit to execute
            */
            //let allFlashloanPromises = [];
            let highestRate = 0;
            let highestRateTrade:ItfTrade;
            for (let i = 0; i < this.trades.length; i++) {
                let thisTrade = this.trades[i];
                let rateForThisTrade:number = 1;
                let hopsStr = "";
                for (let j = 0; j < thisTrade.hops.length; j++) {
                    if (j == 0) {
                        hopsStr += `[${thisTrade.hops[j].tokenFrom.symbol}`
                    }
                    hopsStr += `-(${thisTrade.hops[j].swapRouter.name})-${thisTrade.hops[j].tokenTo.symbol}`;
                    if (j == thisTrade.hops.length - 1) {
                        hopsStr += "]";
                    }
                    rateForThisTrade *= thisTrade.hops[j].maxRate;
                }
                let isProfit = rateForThisTrade > this.isProfitRate;
                flog.debug(`PMTS.refreshAll: isPft:${isProfit}; %:${rateForThisTrade.toFixed(6)}; trade:${hopsStr};`);
                if (isProfit) {
                    if (rateForThisTrade > highestRate) {
                        highestRate = rateForThisTrade;
                        highestRateTrade = thisTrade;
                    }
                }
            }
            this.isBusy = false;
            if (highestRate > 0) {
                if (highestRate == this.previousFlashloanExecutedRate) {
                    flog.debug(`PMTS.refreshAll: highest% is same as this.previousFlashloanExecutedRate, will not execute flashloan`);
                } else {
                    this.previousFlashloanExecutedRate = highestRate;
                    flog.debug(`PMTS.refreshAll: highest%:${highestRate.toFixed(6)}; will execute flashloan for this trade;`);
                    let [resultsStr, txHash] = await PCKFlashloanExecutor.executeFlashloanTrade(highestRateTrade!);
                    flog.debug(`PMTS.refreshAll: flashloan executor called, txHash:${txHash}; results:${resultsStr}; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
                }
            }
            //log4js.shutdown(function() { process.exit(1); });
        });



    }
}
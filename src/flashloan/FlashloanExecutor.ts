import {ISwapRoutes, IParams, IToken, ISwap, IHop, IFlashloanRoute, ISwapPairRoutes} from "../interfaces";
import * as log4js from "log4js";
import {ethers} from "ethers";
import * as FlashloanJson from "../abis/Flashloan.json";
import {dodoV2Pool, PROTOCOL_ROUTER, SWAP_ROUTER} from "../addresses";
import {getBigNumber} from "../utility";
import {PCKWeb3Handler} from "../utils/Web3Handler";
import {PCKFLBConfig} from "../config";
import {PCKPriceV3} from "../uniswap/priceV3"
import {gasPriceCalculator} from "../utils/GasPriceCalculator";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");

type testedPoolMap = { [erc20Address: string]: string[] };
const testedPools: testedPoolMap = {
    WETH: [dodoV2Pool.WETH_USDC],
    USDC: [dodoV2Pool.WETH_USDC],
    WMATIC: [dodoV2Pool.WMATIC_USDC],
    USDT: [dodoV2Pool.USDT_USDC],
  };

class FlashloanExecutor {
    private static _instance: FlashloanExecutor;

    private constructor() {
    }

    public static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    private getLendingPool (borrowingToken: IToken) {
        return testedPools[borrowingToken.symbol][0];
    }

    public async executeFlashloan(swapRoutes:ISwapRoutes):Promise<string> {
        // currently assume swapRoutes only has 2 routes with 1 hop in each
        if (swapRoutes.idxBestRouterToAmountList.length != 2) {
          let msg = `FlEx.executeFlashloan: ERROR - currently only support swapRoutes.idxBestRouterToAmountList.length == 2; thisLength:${swapRoutes.idxBestRouterToAmountList.length};`;
          clog.error(msg);
          flog.error(msg);
          return "ERROR";
        } 
        return this.executeFlashloanWithIdxs(swapRoutes, swapRoutes.idxBestRouterToAmountList[0], swapRoutes.idxBestRouterToAmountList[1]);
    }
    public async executeFlashloanPair(firstSwap:ISwapPairRoutes, firstRouteIdx:number, secondSwap:ISwapPairRoutes, secondRouteIdx:number) : Promise<string> {
        if (PCKFLBConfig.remainingFlashloanTries <= 0) {
          flog.debug(`FlEx.executeFlashloanPair: will not execute flashloan; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
          return "NOT EXECUTED";
        }
        let firstFromToken = firstSwap.fromToken;

        let flashloanPool = this.getLendingPool(firstFromToken);
        let bnLoanAmount = getBigNumber(PCKFLBConfig.loanAmountUSDx, firstFromToken.decimals);
        let firstToToken = firstSwap.toToken;
        let firstRoute = firstSwap.routerToAmountList[firstRouteIdx];
        let firstRouteProtocol = firstRoute.router.protocol;

        let secondFromToken = secondSwap.fromToken;
        let secondToToken = secondSwap.toToken;
        let secondRoute = secondSwap.routerToAmountList[secondRouteIdx];
        let secondRouteProtocol = secondRoute.router.protocol;

        let params:IParams = {
          flashLoanPool:flashloanPool,
          loanAmount: bnLoanAmount,
          firstRoutes:[],
          secondRoutes:[]
      }

      let aFirstRoutes = this.toRoute(firstRouteProtocol, firstFromToken, firstToToken);
      //let msg = `FlEx.executeFlashloan: aFirstRoutes:${JSON.stringify(aFirstRoutes)};`;
      //clog.debug(msg);
      //flog.debug(msg);
      let aSecondRoutes = this.toRoute(secondRouteProtocol, secondFromToken, secondToToken);
      //msg = `FlEx.executeFlashloan: aSecondRoutes:${JSON.stringify(aSecondRoutes)};`;
      //clog.debug(msg);
      //flog.debug(msg);
      params.firstRoutes = aFirstRoutes;
      params.secondRoutes = aSecondRoutes;

      let executionGasPrice = await gasPriceCalculator.getGasPrice();
      let gasPriceLimit = PCKFLBConfig.gasPriceLimit;

      if (executionGasPrice > gasPriceLimit) {
        flog.debug(`FlEx.executeFlashloanPair: gasPrice too high, will not execute flashloan; executionGasPrice:${executionGasPrice};`);
        return "NOT EXECUTED";
      }

      flog.debug(`FlEx.executeFlashloanPair: about to flashloan...; executionGasPrice:${executionGasPrice};`);
      /*
      if (true) {
        return "DEBUG";
      }
      */
      const Flashloan = new ethers.Contract(
          PCKFLBConfig.flashloanContractAddress,
          FlashloanJson.abi,
          PCKWeb3Handler.web3Provider
      );
      let results = "NEW";
      try {
        let tx = await Flashloan.connect(PCKWeb3Handler.web3Signer).dodoFlashLoan(params, {
          gasLimit: PCKFLBConfig.gasLimit,
          gasPrice: ethers.utils.parseUnits(`${executionGasPrice}`, "gwei"),
          });
        flog.debug(`FlEx.executeFlashloanPair: flashloan executed; tx.hash:${tx.hash};`);
        PCKFLBConfig.remainingFlashloanTries--;
        results = "EXECUTED";
      } catch (ex) {
        let msg = `FlEx.executeFlashloanPair: ERROR;`;
        clog.error(msg);
        flog.error(msg);
        flog.error(ex);
        results = "ERROR";
      }
      return results;
    }

    public async executeFlashloanWithIdxs(swapRoutes:ISwapRoutes, firstRouteIdx:number, secondRouteIdx:number) : Promise<string> {
        if (PCKFLBConfig.remainingFlashloanTries <= 0) {
          flog.debug(`FlEx.executeFlashloanWithIdxs: will not execute flashloan; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
          return "NOT EXECUTED";
        }
        //clog.debug(`FlEx.executeFlashloan: 1.0;`);
        let tokenIn = swapRoutes.swapPairRoutes[0].fromToken;
        let flashloanPool = this.getLendingPool(tokenIn);
        let bnLoanAmount = getBigNumber(PCKFLBConfig.loanAmountUSDx, tokenIn.decimals);
        //clog.debug(`FlEx: flashloanPool:${flashloanPool}; bnLoanAmount:${bnLoanAmount};`);
        
        let firstSwapPairRoutes = swapRoutes.swapPairRoutes[0];
        let firstFromToken = firstSwapPairRoutes.fromToken;
        let firstToToken = firstSwapPairRoutes.toToken;
        let firstRoute = firstSwapPairRoutes.routerToAmountList[firstRouteIdx];
        let firstRouteProtocol = firstRoute.router.protocol;

        let secondSwapPairRoutes = swapRoutes.swapPairRoutes[1];
        let secondFromToken = secondSwapPairRoutes.fromToken;
        let secondToToken = secondSwapPairRoutes.toToken;
        let secondRoute = secondSwapPairRoutes.routerToAmountList[secondRouteIdx];
        let secondRouteProtocol = secondRoute.router.protocol;
        
        let params:IParams = {
            flashLoanPool:flashloanPool,
            loanAmount: bnLoanAmount,
            firstRoutes:[],
            secondRoutes:[]
        }

        let aFirstRoutes = this.toRoute(firstRouteProtocol, firstFromToken, firstToToken);
        //let msg = `FlEx.executeFlashloan: aFirstRoutes:${JSON.stringify(aFirstRoutes)};`;
        //clog.debug(msg);
        //flog.debug(msg);
        let aSecondRoutes = this.toRoute(secondRouteProtocol, secondFromToken, secondToToken);
        //msg = `FlEx.executeFlashloan: aSecondRoutes:${JSON.stringify(aSecondRoutes)};`;
        //clog.debug(msg);
        //flog.debug(msg);
        params.firstRoutes = aFirstRoutes;
        params.secondRoutes = aSecondRoutes;

        let executionGasPrice = await gasPriceCalculator.getGasPrice();
        let gasPriceLimit = PCKFLBConfig.gasPriceLimit;

        if (executionGasPrice > gasPriceLimit) {
          flog.debug(`FlEx.executeFlashloanWithIdxs: gasPrice too high, will not execute flashloan; executionGasPrice:${executionGasPrice};`);
          return "NOT EXECUTED";
        }

        flog.debug(`FlEx.executeFlashloanWithIdxs: about to flashloan...; executionGasPrice:${executionGasPrice};`);
        /*
        if (true) {
          return "DEBUG";
        }
        */
        const Flashloan = new ethers.Contract(
            PCKFLBConfig.flashloanContractAddress,
            FlashloanJson.abi,
            PCKWeb3Handler.web3Provider
        );
        let results = "NEW";
        try {
          let tx = await Flashloan.connect(PCKWeb3Handler.web3Signer).dodoFlashLoan(params, {
            gasLimit: PCKFLBConfig.gasLimit,
            gasPrice: ethers.utils.parseUnits(`${executionGasPrice}`, "gwei"),
            });
          flog.debug(`FlEx.executeFlashloanWithIdxs: flashloan executed; tx.hash:${tx.hash};`);
          PCKFLBConfig.remainingFlashloanTries--;
          results = "EXECUTED";
        } catch (ex) {
          let msg = `FlEx.executeFlashloanWithIdxs: ERROR;`;
          clog.error(msg);
          flog.error(msg);
          flog.error(ex);
          results = "ERROR";
        }
        
        return results;

    }

    private toRoute(protocol:number, fromToken:IToken, toToken:IToken) {
        let routes:IFlashloanRoute[] = [];
        let aRoute:IFlashloanRoute = {
            part:10000,
            hops:[]
        }
        aRoute.hops = this.toHops(protocol, fromToken, toToken);
        routes.push(aRoute);
        return routes;
    }

    private toHops(protocol:number, fromToken:IToken, toToken:IToken) {
        let hops:IHop[] = [];
        let aHop:IHop = {
            path:[],
            swaps:[]
        }
        aHop.path.push(fromToken.address);
        aHop.path.push(toToken.address);
        let aSwaps = this.toSwaps(protocol, fromToken, toToken);
        aHop.swaps = aSwaps;
        hops.push(aHop);
        return hops;
      };

    private toSwaps(protocol:number, fromToken:IToken, toToken:IToken) {
        let swaps:ISwap[] = [];
        let aSwap:ISwap = {
            protocol:0,
            part:10000,
            data:""
        }
        aSwap.protocol = protocol;
        aSwap.data = this.getProtocolData(protocol, fromToken, toToken);

        swaps.push(aSwap);
        return swaps;
      }
      

      private getProtocolData (protocol: number, fromToken: IToken, toToken: IToken) {
        if (protocol === 0) {
          // uniswap V3
          return ethers.utils.defaultAbiCoder.encode(
            ["address", "uint24"],
            [SWAP_ROUTER[PROTOCOL_ROUTER[protocol]].address, PCKPriceV3.getFeeOnUniV3(fromToken.symbol, toToken.symbol)]
          );
        } else {
          // uniswap V2
          return ethers.utils.defaultAbiCoder.encode(
            ["address"],
            [SWAP_ROUTER[PROTOCOL_ROUTER[protocol]].address]
          );
        }
      }

}

export const PCKFlashloanExecutor = FlashloanExecutor.Instance;
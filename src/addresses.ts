import { IToken, IRouter } from "./interfaces";

type erc20Token = { [erc20: string]: IToken };

export var ERC20_TOKEN: erc20Token = {
    MATIC: {
      symbol: "MATIC",
      name: "MATIC",
      decimals: 18,
      address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      amountForSwap: 0
    },
    USDC: {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
      amountForSwap: 0
    },
    USDT: {
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
      amountForSwap: 0
    },
    DAI: {
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      address: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
      amountForSwap: 0
    },
    WBTC: {
      symbol: "WBTC",
      name: "Wrapped BTC",
      decimals: 8,
      address: "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6",
      amountForSwap: 0
    },
    LINK: {
      symbol: "LINK",
      name: "ChainLink Token",
      decimals: 18,
      address: "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39",
      amountForSwap: 0
    },
    WMATIC: {
      symbol: "WMATIC",
      name: "Wrapped Matic",
      decimals: 18,
      address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
      amountForSwap: 0
    },
    WETH: {
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
      amountForSwap: 0
    }
  };

type routerAddress = { [protocol: string]: IRouter };

export const SWAP_ROUTER: routerAddress = {
    POLYGON_UNISWAP_V3: {
        name: "POLYGON_UNISWAP_V3",
        address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        protocol: 0
    },
    POLYGON_SUSHISWAP: {
        name: "POLYGON_SUSHISWAP",
        address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        protocol: 1
    },
    POLYGON_QUICKSWAP: {
        name: "POLYGON_QUICKSWAP",
        address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
        protocol: 2
    },
    POLYGON_APESWAP: {
        name: "POLYGON_APESWAP",
        address: "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607",
        protocol: 3
    },
    POLYGON_JETSWAP: {
        name: "POLYGON_JETSWAP",
        address: "0x5C6EC38fb0e2609672BDf628B1fD605A523E5923",
        protocol: 4
    },
    POLYGON_POLYCAT: {
        name: "POLYGON_POLYCAT",
        address: "0x94930a328162957FF1dd48900aF67B5439336cBD",
        protocol: 5
    },
    POLYGON_WAULTSWAP: {
        name: "POLYGON_WAULTSWAP",
        address: "0x3a1D87f206D12415f5b0A33E786967680AAb4f6d",
        protocol: 6
    }
};

type protocolToRouterMap = { [protocol:number]:string };

export const PROTOCOL_ROUTER: protocolToRouterMap = {
  0 : "POLYGON_UNISWAP_V3",
  1 : "POLYGON_SUSHISWAP",
  2 : "POLYGON_QUICKSWAP",
  3 : "POLYGON_APESWAP",
  4 : "POLYGON_JETSWAP",
  5 : "POLYGON_POLYCAT",
  6 : "POLYGON_WAULTSWAP"
}

export const quoterAddressUniswapV3 = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

type PoolMap = { [pair: string]: string };

export const dodoV2Pool: PoolMap = {
  WETH_USDC: "0x5333Eb1E32522F1893B7C9feA3c263807A02d561",
  WMATIC_USDC: "0x10Dd6d8A29D489BEDE472CC1b22dc695c144c5c7",
  USDT_USDC: "0xA0020444b98f67B77a3d6dE6E66aF11c87da086e",
};
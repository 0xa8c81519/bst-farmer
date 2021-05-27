'use strict'
const log4jsConfig = {
    appenders: {
        stdout: { type: 'stdout' },
        noodle: {
            type: 'dateFile',
            //文件名为= filename + pattern, 设置为alwaysIncludePattern：true
            filename: 'logs/bst-farmer',
            pattern: 'yyyy-MM-dd.log',
            //包含模型
            alwaysIncludePattern: true
        }
    },
    categories: { default: { appenders: ["stdout", "noodle"], level: "debug" } }
};

const config = {
    accountsSize: 11,
    bsc_mainnet: {
        chainId: 56,
        rpc: {
            url: 'https://bsc-dataseed.binance.org/',
        },
        payment: {
            address: '0x830a40032FEA261E57736fce9bB6Cc04124a8459',
        },
        liquidity: {
            address: '0x931B226EBb7134a19B970cBF74f18E40a4239178',
        },
        usdc: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        busd: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        usdt: '0x55d398326f99059ff775485246999027b3197955',
    },
    bsc_testnet: {
        chainId: 97,
        rpc: {
            url: 'https://data-seed-prebsc-2-s2.binance.org:8545/',
        },
        payment: {
            address: '0x6b44BB401BC9c6EE36843b7bac2062937d5425a2',
        },
        liquidity: {
            address: '0x44A08ff464CCAEf948c7973EBa066777Df0143Ce',
        },
        usdc: '0x45374DB08D851B9Fc254d9BF0e67E1607876a7E7',
        busd: '0xa2157E2Ca201a157776494Cbd02723A121359794',
        usdt: '0xD94905fc832754Ea85bCa67C6Ab5FAa66066E12C',
    },

};

module.exports = { log4jsConfig: log4jsConfig, default: config };

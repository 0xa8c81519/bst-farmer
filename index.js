"use strict"
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const ethers = require("ethers");
const { mnemonic } = require('./secret.js');
const log4js = require('log4js');
const config = require('./conf/conf.js');
const PaymentFarmingProxyABIJson = require('./abis/PaymentFarmingProxy.json');
const LiqudityFarmingProxyABIJson = require('./abis/LiquidityFarmingProxy.json');
const BEP20ABIJson = require('./abis/BEP20.json');
// const apiModule = require('./api.js');

log4js.configure(config.log4jsConfig);
const logger = log4js.getLogger('BST Farmer');

let network = process.argv[2];

// 初始化rpc provider，浏览器中不需要
const provider = new ethers.providers.JsonRpcProvider(config.default[network].rpc.url);
let wallets = new Array();
for (let i = 0; i < config.default.accountsSize; i++) {
    let path = "m/44'/60'/0'/0/" + i;
    // 初始化助记词
    let walletMnemonic = ethers.Wallet.fromMnemonic(mnemonic, path);
    // 初始化钱包
    let wallet = walletMnemonic.connect(provider);
    wallets.push(wallet);
}

// let api = apiModule.init(log4js, config.default);

// const paymentFarmingProxyContract = new ethers.Contract(config.default[network].payment.address, PaymentFarmingProxyABIJson.abi, wallets[0]);
// const liquidityFarmingProxyContract = new ethers.Contract(config.default[network].payment.address, PaymentFarmingProxyABIJson.abi, wallets[0]);
// const usdcContract=new ethers.Contract(config.default[network].usdc,BEP20ABIJson.abi,wallet[0]);


let init = () => {
    let payEvent = paymentFarmingProxyContract.filters.Pay(null, null, null, null);
    paymentFarmingProxyContract.on(payEvent, (payToken, receiptToken, payer, receipt) => {

    });
};

let payFarming = () => {

};

let listAccounts = () => {
    logger.info('Accounts: ');
    for (let i = 0; i < wallets.length; i++) {
        logger.info('account[' + i + ']: ' + wallets[i].address);
    }
}

let listAccountsBalance = () => {
    let usdcContract = new ethers.Contract(config.default[network].usdc, BEP20ABIJson.abi, provider);
    let busdContract = new ethers.Contract(config.default[network].busd, BEP20ABIJson.abi, provider);
    let usdtContract = new ethers.Contract(config.default[network].usdt, BEP20ABIJson.abi, provider);
    let arr = new Array();
    wallets.forEach(wallet => {
        let pArr = new Array();
        pArr.push(usdcContract.balanceOf(wallet.address));
        pArr.push(busdContract.balanceOf(wallet.address));
        pArr.push(usdtContract.balanceOf(wallet.address));
        pArr.push(wallet.getBalance());
        arr.push(Promise.all(pArr));
    });
    Promise.all(arr).then(res => {
        res.forEach((e, index) => {
            logger.info("Balance of [" + index + "]: " + wallets[index].address);
            logger.info("USDC: " + ethers.utils.formatEther(e[0]));
            logger.info("BUSD: " + ethers.utils.formatEther(e[1]));
            logger.info("USDT: " + ethers.utils.formatEther(e[2]));
            logger.info("BNB: " + ethers.utils.formatEther(e[3]));
            logger.info("=============================================");
        });
    });
};

let getBalance = (index) => {
    let wallet = wallets[index];
    let usdcContract = new ethers.Contract(config.default[network].usdc, BEP20ABIJson.abi, provider);
    let busdContract = new ethers.Contract(config.default[network].busd, BEP20ABIJson.abi, provider);
    let usdtContract = new ethers.Contract(config.default[network].usdt, BEP20ABIJson.abi, provider);
    let pArr = new Array();
    pArr.push(usdcContract.balanceOf(wallet.address));
    pArr.push(busdContract.balanceOf(wallet.address));
    pArr.push(usdtContract.balanceOf(wallet.address));
    pArr.push(wallet.getBalance());
    Promise.all(pArr).then(res => {
        logger.info("Balance of [" + index + "]: " + wallet.address);
        logger.info("USDC: " + ethers.utils.formatEther(res[0]));
        logger.info("BUSD: " + ethers.utils.formatEther(res[1]));
        logger.info("USDT: " + ethers.utils.formatEther(res[2]));
        logger.info("BNB: " + ethers.utils.formatEther(res[3]));
        logger.info("=============================================");
    });
};

let distributeBNB = (index, amtPerAcc) => {
    let wallet = wallets[0];
    let amt = ethers.utils.parseEther(amtPerAcc);
    wallet.sendTransaction({ to: wallets[index].address, value: amt.toHexString() }).catch(e => {
        console.error("BNB ditribution error on : " + index);
        console.error(e.message);
    });
};

let collectBNB = () => {
    let pArr = new Array();
    wallets.forEach((wallet, index) => {
        pArr.push(wallet.getBalance().then(balance => {
            return wallet.getGasPrice().then(price => {
                let gasFee = ethers.BigNumber.from(21000).mul(price);
                let maxAmt = balance.gt(0) ? ethers.BigNumber.from(0) : balance.sub(gasFee);
                return maxAmt;
            });
        }));
    });
    Promise.all(pArr).then(amts => {
        for (let i = 1; i < wallets.length; i++) {
            wallets[i].sendTransaction({ to: wallets[0].address, value: amts[i].toHexString() }).then().catch(e => {
                logger.error("Collect BNB error at: " + i);
                logger.error(e.message);
            });
        }
    });
};

let distributeToken = (index, amtPerAcc, tokenAddress) => {
    let wallet = wallets[0];
    let usdcContract = new ethers.Contract(tokenAddress, BEP20ABIJson.abi, provider);
    let amt = ethers.utils.parseEther(amtPerAcc);
    usdcContract.connect(wallet).transfer(wallets[index].address, amt).then(() => {
        // getBalance(index);
    }).catch(e => {
        logger.error("Distribution error on : " + index);
        logger.error(e.message);
    });
};

let collectToken = (tokenAddress) => {
    let wallet = wallets[0];
    let pArr = new Array();
    let usdcContract = new ethers.Contract(tokenAddress, BEP20ABIJson.abi, provider);
    for (let i = 0; i < wallets.length; i++) {
        pArr.push(usdcContract.balanceOf(wallets[i].address));
    }
    Promise.all(pArr).then(res => {
        for (let i = 0; i < wallets.length; i++) {
            if (i > 0) {
                usdcContract.connect(wallets[i]).transfer(wallet.address, res[i]).then().catch(e => {
                    logger.error("Collect Token error at: " + i);
                    logger.error(e);
                });
            }
        }
    }).catch(e => {
        logger.error(e);
    })
};

let funName = process.argv[3];
switch (funName) {
    case 'addPool3InitLiquidity':
        break;
    case 'listAccounts':
        logger.info('BST Farmer - listAccounts:');
        listAccounts();
        break;
    case 'listAccountsBalance':
        logger.info('BST Farmer - listAccountsBalance:');
        listAccountsBalance();
        break;
    case 'getBalance':
        logger.info('BST Farmer - getBalance:');
        getBalance(process.argv[4]);
        break;
    case 'distributeBNB':
        logger.info('BST Farmer - distributeBNB:');
        distributeBNB(process.argv[4], process.argv[5]);
        break;
    case 'collectBNB':
        logger.info('BST Farmer - collectBNB:');
        collectBNB();
        break;
    case 'distributeUSDC':
        logger.info('BST Farmer - distributeUSDC:');
        distributeToken(process.argv[4], process.argv[5], config.default[network].usdc);
        break;
    case 'collectUSDC':
        logger.info('BST Farmer - collectUSDC:');
        collectToken(config.default[network].usdc);
        break;
    case 'distributeBUSD':
        logger.info('BST Farmer - distributeBUSD:');
        distributeToken(process.argv[4], process.argv[5], config.default[network].busd);
        break;
    case 'collectBUSD':
        logger.info('BST Farmer - collectBUSD:');
        collectToken(config.default[network].busd);
        break;
    case 'distributeUSDT':
        logger.info('BST Farmer - distributeUSDT:');
        distributeToken(process.argv[4], process.argv[5], config.default[network].usdt);
        break;
    case 'collectUSDT':
        logger.info('BST Farmer - collectUSDT:');
        collectToken(config.default[network].usdt);
        break;
    case 'collectBST':
        logger.info('BST Farmer - collectBST:');
        collectToken(config.default[network].bst);
        break;
    default: {
        init();
    }
}
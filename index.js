"use strict"
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const ethers = require("ethers");
const { mnemonic } = require('./secret.js');
const log4js = require('log4js');
const config = require('./conf/conf.js');
const PaymentFarmingProxyABIJson = require('./abis/PaymentFarmingProxy.json');
const LiqudityFarmingProxyABIJson = require('./abis/LiquidityFarmingProxy.json');
const BStablePoolABIJson = require('./abis/BStablePool.json');
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

const usdcContract = new ethers.Contract(config.default[network].usdc, BEP20ABIJson.abi, provider);
const busdContract = new ethers.Contract(config.default[network].busd, BEP20ABIJson.abi, provider);
const usdtContract = new ethers.Contract(config.default[network].usdt, BEP20ABIJson.abi, provider);
const paymentContract = new ethers.Contract(config.default[network].payment.address, PaymentFarmingProxyABIJson.abi, provider);
const liquidityContract = new ethers.Contract(config.default[network].liquidity.address, LiqudityFarmingProxyABIJson.abi, provider);

let paymentFarming = async () => {
    let payEvent = paymentContract.filters.Pay(null, null, null, null);
    paymentContract.on(payEvent, (payToken, receiptToken, payer, receipt) => {
        logger.info('Get a payment:');
        logger.info('payToken: ' + payToken);
        logger.info('receiptToken: ' + receiptToken);
        logger.info('payer: ' + payer);
        logger.info('receipt: ' + receipt);
        logger.info('==============================');
    });
    for (; true;) {
        let delayMS = Math.floor(Math.random() * 10 * 1000);
        //     setTimeout(() => {
        //     }, delayMS);
        await delay(delayMS);
        let wltIndex = Math.floor(Math.random() * 10);
        let recIndex = Math.floor(Math.random() * 10);
        let coiIndex = Math.floor(Math.random() * 3);
        let wallet = wallets[wltIndex];
        let coins = new Array();
        coins.push(usdcContract);
        coins.push(busdContract);
        coins.push(usdtContract);
        let randomAmtPercent = Math.floor(Math.random() * 100);
        let balance = await coins[coiIndex].balanceOf(wallet.address);
        let amt = balance.mul(randomAmtPercent).div(100);
        await coins[coiIndex].connect(wallet).approve(paymentContract.address, amt);
        await delay(5000);
        try {
            await paymentContract.connect(wallet).pay(coins[coiIndex].address, wallets[recIndex].address, amt);
        } catch (e) {
            logger.error(e);
        }
        logger.info('Payment done!');
        await delay(5000);
        try {
            await paymentContract.connect(wallet).withdrawReward();
        } catch (e) {
            logger.error(e);
        }
        logger.info('Withdraw Payment Rward!');
    }
};

let listAccounts = () => {
    logger.info('Accounts: ');
    for (let i = 0; i < wallets.length; i++) {
        logger.info('account[' + i + ']: ' + wallets[i].address);
    }
}

let listAccountsBalance = () => {
    let arr = new Array();
    wallets.forEach(wallet => {
        let pArr = new Array();
        pArr.push(usdcContract.balanceOf(wallet.address));
        pArr.push(busdContract.balanceOf(wallet.address));
        pArr.push(usdtContract.balanceOf(wallet.address));
        pArr.push(wallet.getBalance());
        pArr.push(paymentContract.pool().then(pool => {
            let poolContract = new ethers.Contract(pool, BStablePoolABIJson.abi, provider);
            return poolContract.balanceOf(wallet.address);
        }));
        pArr.push(paymentContract.token().then(bst => {
            let bstContract = new ethers.Contract(bst, BEP20ABIJson.abi, provider);
            return bstContract.balanceOf(wallet.address);
        }));
        arr.push(Promise.all(pArr));
    });
    Promise.all(arr).then(res => {
        res.forEach((e, index) => {
            logger.info("Balance of [" + index + "]: " + wallets[index].address);
            logger.info("USDC: " + ethers.utils.formatEther(e[0]));
            logger.info("BUSD: " + ethers.utils.formatEther(e[1]));
            logger.info("USDT: " + ethers.utils.formatEther(e[2]));
            logger.info("BNB: " + ethers.utils.formatEther(e[3]));
            logger.info("BSPL-03: " + ethers.utils.formatEther(e[4]));
            logger.info("BST: " + ethers.utils.formatEther(e[5]));
            logger.info("==============================");
        });
    });
};

let getBalance = (index) => {
    let wallet = wallets[index];
    let pArr = new Array();
    pArr.push(usdcContract.balanceOf(wallet.address));
    pArr.push(busdContract.balanceOf(wallet.address));
    pArr.push(usdtContract.balanceOf(wallet.address));
    pArr.push(wallet.getBalance());
    pArr.push(paymentContract.pool().then(pool => {
        let poolContract = new ethers.Contract(pool, BStablePoolABIJson.abi, provider);
        return poolContract.balanceOf(wallet.address);
    }));
    pArr.push(paymentContract.token().then(bst => {
        let bstContract = new ethers.Contract(bst, BEP20ABIJson.abi, provider);
        return bstContract.balanceOf(wallet.address);
    }));
    Promise.all(pArr).then(res => {
        logger.info("Balance of [" + index + "]: " + wallet.address);
        logger.info("USDC: " + ethers.utils.formatEther(res[0]));
        logger.info("BUSD: " + ethers.utils.formatEther(res[1]));
        logger.info("USDT: " + ethers.utils.formatEther(res[2]));
        logger.info("BNB: " + ethers.utils.formatEther(res[3]));
        logger.info("BSPL-03: " + ethers.utils.formatEther(res[4]));
        logger.info("BST: " + ethers.utils.formatEther(res[5]));
        logger.info("==============================");
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

let addPool3InitLiquidity = (amts) => {
    let wallet = wallets[0];
    paymentContract.pool().then(pool => {
        let poolContract = new ethers.Contract(pool, BStablePoolABIJson.abi, provider);
        let _amts = new Array();
        let approveArr = new Array();
        amts.forEach((e, i) => {
            let amt = ethers.utils.parseEther(e);
            _amts.push(amt);
        });
        usdcContract.connect(wallet).approve(poolContract.address, _amts[0]).then(r => {
            return busdContract.connect(wallet).approve(poolContract.address, _amts[1]);
        }).then(r => {
            return usdtContract.connect(wallet).approve(poolContract.address, _amts[2]);
        }).then(r => {
            return poolContract.connect(wallet).add_liquidity(_amts, 0).then();
        });
    });
};

let funName = process.argv[3];
switch (funName) {
    case 'addLiquidity':
        logger.info('BST Farmer - addLiquidity:');
        let arr = new Array();
        arr.push(process.argv[4]);
        arr.push(process.argv[5]);
        arr.push(process.argv[6]);
        addPool3InitLiquidity(arr);
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
        paymentContract.token().then(bst => {
            return collectToken(bst);
        });
        break;
    case 'paymentFarming':
        logger.info('BST Farmer - Payment Farming');
        paymentFarming();
        break;
    default: {
        logger.info('BST Farmer - starting');
    }
}
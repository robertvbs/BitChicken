import type { HardhatUserConfig } from 'hardhat/config';
import { configVariable } from 'hardhat/config';
import hardhatToolboxMochaEthers from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import hardhatUpgrades from '@openzeppelin/hardhat-upgrades';
import 'dotenv/config';

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthers, hardhatUpgrades],
  solidity: {
    compilers: [
      {
        version: '0.8.35',
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: 'cancun',
          viaIR: true,
        },
      },
      {
        version: '0.8.19',
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: 'paris',
        },
      },
    ],
  },
  networks: {
    hardhat: {
      type: 'edr-simulated',
      chainType: 'l1',
    },
    localhost: {
      type: 'http',
      chainType: 'l1',
      url: 'http://127.0.0.1:8545',
    },
    bscTestnet: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('BSC_TESTNET_RPC_URL'),
      accounts: [configVariable('MAIN_PRIVATE_KEY')],
      chainId: 97,
    },
    bscMainnet: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('BSC_RPC_URL'),
      accounts: [configVariable('MAIN_PRIVATE_KEY')],
      chainId: 56,
    },
  },
  verify: {
    etherscan: {
      apiKey: configVariable('BSCSCAN_API_KEY'),
    },
  },
};

export default config;

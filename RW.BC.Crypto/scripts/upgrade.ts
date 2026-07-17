import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import chalk from 'chalk';
import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';

const UPGRADEABLE = [
  { key: 'token', contract: 'BitChickenToken', env: 'TOKEN_PROXY' },
  { key: 'nft', contract: 'BitChickenNFT', env: 'NFT_PROXY' },
  { key: 'staking', contract: 'BitChickenStaking', env: 'STAKING_PROXY' },
  { key: 'marketplace', contract: 'BitChickenMarketplace', env: 'MARKETPLACE_PROXY' },
] as const;

function loadLocalAddresses(): Record<string, string> {
  const path = 'scripts/deployed-localhost.json';
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf-8')) as Record<string, string>) : {};
}

async function main() {
  const connection = await hre.network.create();
  const { ethers } = connection;
  const upgradesApi = await upgrades(hre, connection);
  const local = loadLocalAddresses();
  const only = process.env.UPGRADE_ONLY;

  console.log(chalk.blueBright(`Upgrading BitChicken proxies on network: ${connection.networkName}`));

  for (const { key, contract, env } of UPGRADEABLE) {
    if (only && only !== key) continue;
    const address = process.env[env] ?? local[key];
    if (!address || !ethers.isAddress(address)) {
      console.log(chalk.yellow(`  Skipping ${contract}: no valid proxy address (set ${env} or run deploy first).`));
      continue;
    }
    console.log(chalk.cyan(`  Validating + upgrading ${contract} @ ${address}`));
    const Factory = await ethers.getContractFactory(contract);
    await upgradesApi.validateUpgrade(address, Factory);
    const upgraded = await upgradesApi.upgradeProxy(address, Factory);
    await upgraded.waitForDeployment();
    console.log(chalk.green(`  ${contract} upgraded (proxy unchanged: ${address})`));
  }

  console.log(chalk.green('Upgrade run complete.'));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.redBright('Error during upgrade:'), error);
    process.exit(1);
  });

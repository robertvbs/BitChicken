import 'dotenv/config';
import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import hre from 'hardhat';
import { verifyContract } from '@nomicfoundation/hardhat-verify/verify';

type Deployed = {
  token: string;
  nft: string;
  staking: string;
  marketplace: string;
  forge: string;
  implementations: {
    token: string;
    nft: string;
    staking: string;
    marketplace: string;
  };
};

function loadDeployed(): Deployed {
  return JSON.parse(readFileSync('scripts/deployed-localhost.json', 'utf-8')) as Deployed;
}

async function main() {
  const connection = await hre.network.create();

  if (connection.networkName === 'localhost' || connection.networkName === 'hardhat') {
    console.log(chalk.yellow('Contract verification cannot be run on local networks.'));
    process.exit(0);
  }

  const deployed = loadDeployed();

  console.log(chalk.blueBright('Verifying BitChicken contracts on BSCScan...'));
  console.log(chalk.cyan(`  Token proxy:       ${deployed.token}`));
  console.log(chalk.cyan(`  Token impl:        ${deployed.implementations.token}`));
  console.log(chalk.cyan(`  NFT proxy:         ${deployed.nft}`));
  console.log(chalk.cyan(`  NFT impl:          ${deployed.implementations.nft}`));
  console.log(chalk.cyan(`  Staking proxy:     ${deployed.staking}`));
  console.log(chalk.cyan(`  Staking impl:      ${deployed.implementations.staking}`));
  console.log(chalk.cyan(`  Marketplace proxy: ${deployed.marketplace}`));
  console.log(chalk.cyan(`  Marketplace impl:  ${deployed.implementations.marketplace}`));
  console.log(chalk.cyan(`  Forge:             ${deployed.forge}`));

  await verify('BitChickenToken (impl)', deployed.implementations.token, []);
  await verify('BitChickenNFT (impl)', deployed.implementations.nft, []);
  await verify('BitChickenStaking (impl)', deployed.implementations.staking, []);
  await verify('BitChickenMarketplace (impl)', deployed.implementations.marketplace, []);
  await verify('BitChickenForge', deployed.forge, []);
}

async function verify(label: string, address: string, constructorArgs: unknown[]) {
  console.log(chalk.magenta(`Verifying ${label} at ${address}...`));
  try {
    await verifyContract({ address, constructorArgs, provider: 'etherscan' }, hre);
    console.log(chalk.green(`${label} verified successfully.`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('already verified')) {
      console.log(chalk.yellow(`${label} is already verified.`));
    } else {
      console.error(chalk.red(`Error verifying ${label}:`), message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.redBright('Error during verification:'), error);
    process.exit(1);
  });

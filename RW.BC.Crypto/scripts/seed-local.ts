import 'dotenv/config';
import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import hre from 'hardhat';

type Deployed = {
  token: string;
  nft: string;
  staking: string;
  marketplace: string;
  forge: string;
  vrfMock: string;
  vrfSubId: string;
  admin: string;
};

function loadDeployed(): Deployed {
  return JSON.parse(readFileSync('scripts/deployed-localhost.json', 'utf-8')) as Deployed;
}

async function main() {
  const { ethers } = await hre.network.create();
  const [signer] = await ethers.getSigners();
  const deployed = loadDeployed();

  console.log(chalk.blueBright('Re-seeding BitChicken ecosystem on local testnet...'));
  console.log(chalk.cyan(`Signer: ${signer.address}`));
  console.log(chalk.cyan(`Admin:  ${deployed.admin}`));

  const token = (await ethers.getContractFactory('BitChickenToken')).attach(deployed.token);
  const nft = (await ethers.getContractFactory('BitChickenNFT')).attach(deployed.nft);
  const staking = (await ethers.getContractFactory('BitChickenStaking')).attach(deployed.staking);

  await (await token.connect(signer).setEmissionCap(ethers.parseEther('1000000000'))).wait();

  const tierPrices: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
    ethers.parseEther('0.01'),
    ethers.parseEther('0.02'),
    ethers.parseEther('0.03'),
    ethers.parseEther('0.04'),
    ethers.parseEther('0.05'),
    ethers.parseEther('0.06'),
    ethers.parseEther('0.07'),
    ethers.parseEther('0.08'),
    ethers.parseEther('0.09'),
    ethers.parseEther('0.10'),
  ];
  await (await nft.connect(signer).updateTierPrices(tierPrices)).wait();
  await (await nft.connect(signer).setReferralLevels([0n, 3n, 6n, 8n, 10n], [200, 400, 600, 800, 1000])).wait();
  await (await nft.connect(signer).setRenamePrice(ethers.parseEther('50'))).wait();

  await (await staking.connect(signer).setBaseRate(1n * 10n ** 17n)).wait();
  await (await staking.connect(signer).setWeights(1n * 10n ** 18n, 1n * 10n ** 18n, 1n * 10n ** 18n)).wait();
  await (await staking.connect(signer).setClaimBurnBps(500n)).wait();
  await (await staking.connect(signer).setIdealPairMultiplierBps(20000n)).wait();

  console.log(chalk.bold.bgGreen('Ecosystem re-seeded!'));
  console.log(chalk.cyan('  Emission cap: 1,000,000,000 BCKN'));
  console.log(chalk.cyan('  Tier prices:  0.01 .. 0.10 BNB'));
  console.log(chalk.cyan('  Staking:      baseRate, weights, 5% burn, 2x ideal-pair'));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.redBright('Error in seed:'), error);
    process.exit(1);
  });

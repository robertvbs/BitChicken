import 'dotenv/config';
import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import hre from 'hardhat';

type Deployed = {
  nft: string;
  forge: string;
  vrfMock: string;
  vrfSubId: string;
};

function loadDeployed(): Deployed {
  return JSON.parse(readFileSync('scripts/deployed-localhost.json', 'utf-8')) as Deployed;
}

async function main() {
  const { ethers } = await hre.network.create();
  const [buyer] = await ethers.getSigners();
  const deployed = loadDeployed();

  if (!deployed.vrfMock) {
    console.error(chalk.redBright('forge-helper only works on localnet (vrfMock required)'));
    process.exit(1);
  }

  const tier = Number(process.env.FORGE_TIER ?? '0');
  const referrerCode = BigInt(process.env.FORGE_REFERRER ?? '0');
  const tokenName = process.env.FORGE_NAME ?? 'TestChicken';

  console.log(chalk.blueBright('Driving a gacha forge on localnet...'));
  console.log(chalk.cyan(`Buyer: ${buyer.address}, tier: ${tier}, name: ${tokenName}`));

  const nft = (await ethers.getContractFactory('BitChickenNFT')).attach(deployed.nft);
  const forge = (await ethers.getContractFactory('BitChickenForge')).attach(deployed.forge);
  const vrfMock = (await ethers.getContractFactory('VRFCoordinatorMock')).attach(deployed.vrfMock);

  const tierPrice = await nft.tierPrice(tier);
  console.log(chalk.cyan(`Tier ${tier} price: ${ethers.formatEther(tierPrice)} BNB`));

  const available = await nft.tierHasAvailable(tier);
  if (!available) {
    console.error(chalk.redBright(`No editions available for tier ${tier}`));
    process.exit(1);
  }

  const tokensBefore = await nft.nextId();
  console.log(chalk.cyan(`NFT nextId before: ${tokensBefore}`));

  const requestTx = await forge.connect(buyer).requestObtain(tier, referrerCode, tokenName, { value: tierPrice });
  const requestRcpt = await requestTx.wait();

  const forgeRequestedTopic = ethers.id('ForgeRequested(address,uint256,uint8)');
  const requestLog = requestRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === forgeRequestedTopic);
  if (!requestLog) {
    console.error(chalk.redBright('ForgeRequested event not found'));
    process.exit(1);
  }

  const requestId = BigInt(requestLog.topics[2]);
  console.log(chalk.cyan(`ForgeRequested — requestId: ${requestId}`));

  const fulfillTx = await vrfMock.fulfillRandomWords(requestId, deployed.forge);
  await fulfillTx.wait();

  const tokensAfter = await nft.nextId();
  if (tokensAfter <= tokensBefore) {
    console.error(chalk.redBright('NFT was not minted — fulfillment may have failed'));
    process.exit(1);
  }

  const newTokenId = tokensAfter - 1n;
  const [editionId, gender, name] = await nft.tokenData(newTokenId);
  const edition = await nft.getEdition(editionId);
  const [health, skill, morale] = await nft.attributesOf(newTokenId);

  console.log('');
  console.log(chalk.bold.bgGreen('Gacha forge succeeded!'));
  console.log(chalk.cyan(`  tokenId:   ${newTokenId}`));
  console.log(chalk.cyan(`  editionId: ${editionId} (${edition.name})`));
  console.log(chalk.cyan(`  gender:    ${gender === 0n ? 'Male' : 'Female'}`));
  console.log(chalk.cyan(`  name:      ${name}`));
  console.log(chalk.cyan(`  health:    ${health}, skill: ${skill}, morale: ${morale}`));
  console.log(chalk.cyan(`  artURI:    ${edition.artURI}`));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.redBright('Error in forge-helper:'), error);
    process.exit(1);
  });

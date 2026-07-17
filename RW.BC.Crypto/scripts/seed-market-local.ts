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
  const signers = await ethers.getSigners();
  const deployed = loadDeployed();

  const nft = (await ethers.getContractFactory('BitChickenNFT')).attach(deployed.nft);
  const marketplace = (await ethers.getContractFactory('BitChickenMarketplace')).attach(deployed.marketplace);

  console.log(chalk.blueBright('Seeding marketplace listings on local testnet...'));

  const prices = [
    ethers.parseEther('0.25'),
    ethers.parseEther('0.5'),
    ethers.parseEther('1'),
    ethers.parseEther('2.5'),
  ];

  const nextId: bigint = await nft.nextId();
  const totalMinted = nextId - 1n;

  const signerAddresses = new Set(signers.map((s: { address: string }) => s.address.toLowerCase()));

  let listed = 0;
  for (let tokenId = 1n; tokenId <= totalMinted && listed < prices.length; tokenId++) {
    let ownerAddr: string;
    try {
      ownerAddr = await nft.ownerOf(tokenId);
    } catch {
      continue;
    }
    if (!signerAddresses.has(ownerAddr.toLowerCase())) continue;

    const signer = signers.find((s: { address: string }) => s.address.toLowerCase() === ownerAddr.toLowerCase());
    if (!signer) continue;

    const price = prices[listed];
    try {
      await (await nft.connect(signer).approve(deployed.marketplace, tokenId)).wait();
      await (await marketplace.connect(signer).list(tokenId, price)).wait();
      console.log(chalk.cyan(`  Listed token #${tokenId} for ${ethers.formatEther(price)} BNB by ${signer.address}`));
      listed += 1;
    } catch {
      continue;
    }
  }

  if (listed === 0) {
    console.log(chalk.yellow('  No owned NFTs found to list. Run "npm run seed-nfts:localhost" first.'));
  } else {
    console.log(chalk.bold.bgGreen(`Marketplace seeded with ${listed} listing(s)!`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

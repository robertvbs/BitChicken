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

async function fulfillForge(
  vrfMock: { fulfillRandomWords(requestId: bigint, consumer: string): Promise<{ wait(): Promise<unknown> }> },
  forgeAddress: string,
  receipt: { logs: { topics: string[] }[] } | null,
  ethers: { id(s: string): string },
): Promise<void> {
  const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
  const reqLog = receipt?.logs.find((l) => l.topics[0] === topic);
  if (!reqLog) throw new Error('ForgeRequested log not found');
  const requestId = BigInt(reqLog.topics[2]);
  await (await vrfMock.fulfillRandomWords(requestId, forgeAddress)).wait();
}

async function main() {
  const { ethers } = await hre.network.create('localhost');
  const signers = await ethers.getSigners();
  const deployed = loadDeployed();

  if (!deployed.vrfMock) {
    console.error(
      chalk.redBright('seed-nfts requires a localnet VRF mock (vrfMock not set in deployed-localhost.json)'),
    );
    process.exit(1);
  }

  const nft = (await ethers.getContractFactory('BitChickenNFT')).attach(deployed.nft);
  const forge = (await ethers.getContractFactory('BitChickenForge')).attach(deployed.forge);
  const vrfMock = (await ethers.getContractFactory('VRFCoordinatorMock')).attach(deployed.vrfMock) as unknown as {
    fulfillRandomWords(requestId: bigint, consumer: string): Promise<{ wait(): Promise<unknown> }>;
  };

  const tier0Price = await nft.tierPrice(0);

  const recipients = signers.slice(1, 4);
  console.log(chalk.blueBright(`Seeding Male + Female pairs to ${recipients.length} dev accounts...`));

  for (const account of recipients) {
    let maleId: bigint | undefined;
    let femaleId: bigint | undefined;
    let gachaAttempts = 0;

    while ((maleId === undefined || femaleId === undefined) && gachaAttempts < 40) {
      gachaAttempts++;
      const reqTx = await forge.connect(account).requestObtain(0, 0n, 'SeedChicken', { value: tier0Price });
      const reqRcpt = await reqTx.wait();
      await fulfillForge(vrfMock, deployed.forge, reqRcpt as { logs: { topics: string[] }[] } | null, ethers);

      const tokenId = (await nft.nextId()) - 1n;
      const [, genderBit] = await nft.tokenData(tokenId);
      if (genderBit === 0n && maleId === undefined) {
        maleId = tokenId;
      } else if (genderBit === 1n && femaleId === undefined) {
        femaleId = tokenId;
      }
    }

    console.log(
      chalk.cyan(`- ${account.address}: gacha male #${maleId} female #${femaleId} (${gachaAttempts} forge(s))`),
    );
  }

  console.log(chalk.bold.bgGreen('NFT seed complete!'));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.redBright('Error seeding NFTs:'), error);
    process.exit(1);
  });

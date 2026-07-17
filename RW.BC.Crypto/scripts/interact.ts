import 'dotenv/config';
import * as readline from 'node:readline/promises';
import { readFileSync } from 'node:fs';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import hre from 'hardhat';

const rl = readline.createInterface({ input, output });

type Deployed = {
  token: string;
  nft: string;
  staking: string;
  marketplace: string;
  forge: string;
  vrfMock: string;
};

function loadDeployed(): Deployed {
  return JSON.parse(readFileSync('scripts/deployed-localhost.json', 'utf-8')) as Deployed;
}

function clearScreen() {
  process.stdout.write('\x1Bc');
}

async function showMenu() {
  console.log(chalk.blueBright('===== Forge ====='));
  console.log(`${chalk.yellow('1:')} Request Obtain (gacha — tier + name)`);
  console.log(`${chalk.yellow('2:')} Fulfill Forge (localnet VRF mock)`);
  console.log(`${chalk.yellow('4:')} Register Referrer`);
  console.log(`${chalk.yellow('5:')} Claim Referral Rewards`);
  console.log('');
  console.log(chalk.blueBright('===== Staking ====='));
  console.log(`${chalk.yellow('10:')} Stake Pair (maleId + femaleId)`);
  console.log(`${chalk.yellow('11:')} Claim Yield (pairId)`);
  console.log(`${chalk.yellow('12:')} Unstake Pair (pairId)`);
  console.log(`${chalk.yellow('13:')} Pending Yield (pairId)`);
  console.log(`${chalk.yellow('14:')} List My Pairs`);
  console.log('');
  console.log(chalk.blueBright('===== Marketplace ====='));
  console.log(`${chalk.yellow('20:')} List NFT for Sale`);
  console.log(`${chalk.yellow('21:')} Cancel Listing`);
  console.log(`${chalk.yellow('22:')} Obtain Listed NFT`);
  console.log(`${chalk.yellow('23:')} Propose Swap`);
  console.log(`${chalk.yellow('24:')} Accept Swap`);
  console.log(`${chalk.yellow('25:')} Cancel Swap`);
  console.log('');
  console.log(chalk.blueBright('===== Admin ====='));
  console.log(`${chalk.yellow('30:')} Set Royalty (receiver + bps)`);
  console.log(`${chalk.yellow('31:')} Set Platform Fee (feeSink + bps)`);
  console.log(`${chalk.yellow('32:')} Set Emission Cap`);
  console.log(`${chalk.yellow('33:')} Update Tier Prices (10 values)`);
  console.log(`${chalk.yellow('34:')} Register Edition`);
  console.log(`${chalk.yellow('35:')} Set Edition Active`);
  console.log(`${chalk.yellow('36:')} Pause / Unpause NFT`);
  console.log(`${chalk.yellow('37:')} Pause / Unpause Staking`);
  console.log(`${chalk.yellow('38:')} Pause / Unpause Marketplace`);
  console.log('');
  console.log(`${chalk.yellow('-1:')} Status`);
  console.log(`${chalk.red('0:')} Exit`);
}

async function main() {
  const { ethers } = await hre.network.create('localhost');
  const deployed = loadDeployed();

  const [owner] = await ethers.getSigners();

  const nft = (await ethers.getContractFactory('BitChickenNFT')).attach(deployed.nft);
  const staking = (await ethers.getContractFactory('BitChickenStaking')).attach(deployed.staking);
  const marketplace = (await ethers.getContractFactory('BitChickenMarketplace')).attach(deployed.marketplace);
  const forge = (await ethers.getContractFactory('BitChickenForge')).attach(deployed.forge);
  const token = (await ethers.getContractFactory('BitChickenToken')).attach(deployed.token);

  const vrfMock = deployed.vrfMock
    ? (await ethers.getContractFactory('VRFCoordinatorMock')).attach(deployed.vrfMock)
    : null;

  let exit = false;
  while (!exit) {
    clearScreen();
    console.log(chalk.cyan(`Owner: ${chalk.yellowBright(owner.address)}`));
    console.log(chalk.greenBright(`NFT: ${deployed.nft}`));
    console.log(chalk.greenBright(`Forge: ${deployed.forge}`));
    console.log(chalk.greenBright(`Staking: ${deployed.staking}`));
    console.log(chalk.greenBright(`Marketplace: ${deployed.marketplace}`));
    console.log('');
    await showMenu();

    const choice = await rl.question(chalk.yellow('\nChoose an option: '));

    switch (choice) {
      case '1': {
        const tierStr = await rl.question(chalk.magenta('Tier (0-9): '));
        const name = await rl.question(chalk.magenta('NFT name: '));
        const refCodeStr = await rl.question(chalk.magenta('Referrer code (0 = none): '));
        const tier = Number(tierStr);
        const price = await nft.tierPrice(tier);
        const tx = await forge.connect(owner).requestObtain(tier, BigInt(refCodeStr), name, { value: price });
        const rcpt = await tx.wait();
        const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
        const reqLog = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
        const requestId = reqLog ? BigInt(reqLog.topics[2]) : 0n;
        console.log(chalk.green(`Forge requested! requestId: ${requestId} — price: ${ethers.formatEther(price)} BNB`));
        break;
      }
      case '2': {
        if (!vrfMock) {
          console.log(chalk.red('VRF mock not available on this network.'));
          break;
        }
        const reqIdStr = await rl.question(chalk.magenta('Request ID to fulfill: '));
        await (await vrfMock.fulfillRandomWords(BigInt(reqIdStr), deployed.forge)).wait();
        const tokenId = (await nft.nextId()) - 1n;
        const [editionId, gender, tokenName] = await nft.tokenData(tokenId);
        console.log(
          chalk.green(
            `Fulfilled! tokenId: ${tokenId}, edition: ${editionId}, gender: ${gender === 0n ? 'Male' : 'Female'}, name: ${tokenName}`,
          ),
        );
        break;
      }
      case '4': {
        const tx = await nft.connect(owner).registerReferrer();
        await tx.wait();
        const code = await nft.getReferrerCode(owner.address);
        console.log(chalk.green(`Referrer registered! Code: ${code}`));
        break;
      }
      case '5': {
        const pending = await forge.pendingReferralBnb(owner.address);
        if (pending === 0n) {
          console.log(chalk.yellow('No pending referral rewards.'));
          break;
        }
        const tx = await forge.connect(owner).claimReferralBnb();
        await tx.wait();
        console.log(chalk.green(`Claimed referral: ${ethers.formatEther(pending)} BNB`));
        break;
      }
      case '10': {
        const maleIdStr = await rl.question(chalk.magenta('Male token ID: '));
        const femaleIdStr = await rl.question(chalk.magenta('Female token ID: '));
        await (await nft.connect(owner).setApprovalForAll(deployed.staking, true)).wait();
        const tx = await staking.connect(owner).stakePair(BigInt(maleIdStr), BigInt(femaleIdStr));
        const rcpt = await tx.wait();
        const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
        const stakeLog = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
        const pairId = stakeLog
          ? staking.interface.decodeEventLog('PairStaked', stakeLog.data, stakeLog.topics).pairId
          : 0n;
        console.log(chalk.green(`Pair staked! pairId: ${pairId}`));
        break;
      }
      case '11': {
        const pairIdStr = await rl.question(chalk.magenta('Pair ID: '));
        const tx = await staking.connect(owner).claim(BigInt(pairIdStr));
        await tx.wait();
        console.log(chalk.green('Yield claimed!'));
        break;
      }
      case '12': {
        const pairIdStr = await rl.question(chalk.magenta('Pair ID: '));
        const tx = await staking.connect(owner).unstakePair(BigInt(pairIdStr));
        await tx.wait();
        console.log(chalk.green('Pair unstaked! NFTs returned.'));
        break;
      }
      case '13': {
        const pairIdStr = await rl.question(chalk.magenta('Pair ID: '));
        const pending = await staking.pendingOf(BigInt(pairIdStr));
        console.log(chalk.cyan(`Pending yield: ${ethers.formatEther(pending)} BCKN (gross, before burn)`));
        break;
      }
      case '14': {
        const count = await staking.getPairsCount(owner.address);
        if (count === 0n) {
          console.log(chalk.yellow('No staked pairs.'));
          break;
        }
        const ids = await staking.getPairs(owner.address, 0n, count);
        for (const id of ids) {
          const pair = await staking.getPair(id);
          const pending = await staking.pendingOf(id);
          console.log(
            chalk.cyan(
              `  pairId=${id} male=#${pair.maleId} female=#${pair.femaleId} matched=${pair.matched} pending=${ethers.formatEther(pending)} BCKN`,
            ),
          );
        }
        break;
      }
      case '20': {
        const tokenIdStr = await rl.question(chalk.magenta('Token ID to list: '));
        const priceStr = await rl.question(chalk.magenta('Price (BNB): '));
        await (await nft.connect(owner).setApprovalForAll(deployed.marketplace, true)).wait();
        await (await marketplace.connect(owner).list(BigInt(tokenIdStr), ethers.parseEther(priceStr))).wait();
        console.log(chalk.green(`Listed token #${tokenIdStr} for ${priceStr} BNB`));
        break;
      }
      case '21': {
        const tokenIdStr = await rl.question(chalk.magenta('Token ID to cancel: '));
        await (await marketplace.connect(owner).cancel(BigInt(tokenIdStr))).wait();
        console.log(chalk.green('Listing cancelled.'));
        break;
      }
      case '22': {
        const tokenIdStr = await rl.question(chalk.magenta('Token ID to buy: '));
        const priceStr = await rl.question(chalk.magenta('Price to pay (BNB): '));
        const buyPrice = ethers.parseEther(priceStr);
        await (await marketplace.connect(owner).obtain(BigInt(tokenIdStr), { value: buyPrice })).wait();
        console.log(chalk.green(`Bought token #${tokenIdStr} for ${priceStr} BNB`));
        break;
      }
      case '23': {
        const offeredIdStr = await rl.question(chalk.magenta('Offered token ID: '));
        const wantedIdStr = await rl.question(chalk.magenta('Wanted token ID: '));
        const bnbStr = await rl.question(chalk.magenta('BNB sweetener (0 = none): '));
        const bnbValue = ethers.parseEther(bnbStr || '0');
        await (await nft.connect(owner).setApprovalForAll(deployed.marketplace, true)).wait();
        const tx = await marketplace
          .connect(owner)
          .proposeSwap(BigInt(offeredIdStr), BigInt(wantedIdStr), { value: bnbValue });
        const rcpt = await tx.wait();
        const topic = ethers.id('SwapProposed(uint256,address,uint256,uint256,uint96)');
        const proposeLog = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
        const swapId = proposeLog ? BigInt(proposeLog.topics[1]) : 0n;
        console.log(chalk.green(`Swap proposed! swapId: ${swapId}`));
        break;
      }
      case '24': {
        const swapIdStr = await rl.question(chalk.magenta('Swap ID to accept: '));
        const swap = await marketplace.getSwap(BigInt(swapIdStr));
        await (await nft.connect(owner).setApprovalForAll(deployed.marketplace, true)).wait();
        await (await marketplace.connect(owner).acceptSwap(BigInt(swapIdStr))).wait();
        console.log(
          chalk.green(`Swap #${swapIdStr} accepted — received token #${swap.offeredId}, sent token #${swap.wantedId}`),
        );
        break;
      }
      case '25': {
        const swapIdStr = await rl.question(chalk.magenta('Swap ID to cancel: '));
        await (await marketplace.connect(owner).cancelSwap(BigInt(swapIdStr))).wait();
        console.log(chalk.green(`Swap #${swapIdStr} cancelled.`));
        break;
      }
      case '30': {
        const receiverStr = await rl.question(chalk.magenta('Royalty receiver address: '));
        const bpsStr = await rl.question(chalk.magenta('Royalty bps (e.g. 500 = 5%): '));
        await (await nft.connect(owner).setRoyalty(receiverStr, BigInt(bpsStr))).wait();
        console.log(chalk.green(`Royalty set: ${receiverStr} @ ${bpsStr} bps`));
        break;
      }
      case '31': {
        const sinkStr = await rl.question(chalk.magenta('Fee sink address: '));
        const bpsStr = await rl.question(chalk.magenta('Platform fee bps (e.g. 250 = 2.5%): '));
        await (await marketplace.connect(owner).setPlatformFee(sinkStr, BigInt(bpsStr))).wait();
        console.log(chalk.green(`Platform fee set: ${sinkStr} @ ${bpsStr} bps`));
        break;
      }
      case '32': {
        const capStr = await rl.question(chalk.magenta('New emission cap (BCKN, e.g. 1000000000): '));
        await (await token.connect(owner).setEmissionCap(ethers.parseEther(capStr))).wait();
        console.log(chalk.green(`Emission cap set to ${capStr} BCKN`));
        break;
      }
      case '33': {
        console.log(chalk.magenta('Enter 10 tier prices in BNB (space-separated, ascending):'));
        const pricesStr = await rl.question('> ');
        const prices = pricesStr
          .trim()
          .split(/\s+/)
          .map((v) => ethers.parseEther(v));
        if (prices.length !== 10) {
          console.log(chalk.red('Need exactly 10 prices.'));
          break;
        }
        await (
          await nft
            .connect(owner)
            .updateTierPrices(
              prices as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
            )
        ).wait();
        console.log(chalk.green('Tier prices updated.'));
        break;
      }
      case '34': {
        const edName = await rl.question(chalk.magenta('Edition name: '));
        const artURI = await rl.question(chalk.magenta('Art URI (ipfs://...): '));
        const health = await rl.question(chalk.magenta('Health: '));
        const skill = await rl.question(chalk.magenta('Skill: '));
        const morale = await rl.question(chalk.magenta('Morale: '));
        const rarity = await rl.question(chalk.magenta('Rarity: '));
        const maxSupply = await rl.question(chalk.magenta('Max supply (0 = uncapped): '));
        const price = await rl.question(chalk.magenta('Price BNB (0 = gacha-only): '));
        const dist = await rl.question(chalk.magenta('Distribution (0=Gacha, 1=DirectSale): '));
        const wStr = await rl.question(chalk.magenta('Tier weights 10 values space-separated (0..100 each): '));
        const weights = wStr.trim().split(/\s+/).map(Number);
        if (weights.length !== 10) {
          console.log(chalk.red('Need exactly 10 weights.'));
          break;
        }
        const tx = await nft
          .connect(owner)
          .registerEdition(
            edName,
            artURI,
            Number(health),
            Number(skill),
            Number(morale),
            Number(rarity),
            Number(maxSupply),
            0n,
            0n,
            ethers.parseEther(price),
            Number(dist),
            weights as [number, number, number, number, number, number, number, number, number, number],
          );
        await tx.wait();
        const edId = await nft.editionCount();
        console.log(chalk.green(`Edition registered with ID: ${edId}`));
        break;
      }
      case '35': {
        const edIdStr = await rl.question(chalk.magenta('Edition ID: '));
        const activeStr = await rl.question(chalk.magenta('Active? (y/n): '));
        const active = activeStr.trim().toLowerCase() === 'y';
        await (await nft.connect(owner).setEditionActive(BigInt(edIdStr), active)).wait();
        console.log(chalk.green(`Edition ${edIdStr} active=${active}`));
        break;
      }
      case '36': {
        const paused = await nft.paused();
        if (paused) {
          await (await nft.connect(owner).unpause()).wait();
          console.log(chalk.green('NFT unpaused.'));
        } else {
          await (await nft.connect(owner).pause()).wait();
          console.log(chalk.green('NFT paused.'));
        }
        break;
      }
      case '37': {
        const paused = await staking.paused();
        if (paused) {
          await (await staking.connect(owner).unpause()).wait();
          console.log(chalk.green('Staking unpaused.'));
        } else {
          await (await staking.connect(owner).pause()).wait();
          console.log(chalk.green('Staking paused.'));
        }
        break;
      }
      case '38': {
        const paused = await marketplace.paused();
        if (paused) {
          await (await marketplace.connect(owner).unpause()).wait();
          console.log(chalk.green('Marketplace unpaused.'));
        } else {
          await (await marketplace.connect(owner).pause()).wait();
          console.log(chalk.green('Marketplace paused.'));
        }
        break;
      }
      case '-1': {
        const nftCount = await nft.nextId();
        const editionCount = await nft.editionCount();
        const tokenName = await token.name();
        const tokenSymbol = await token.symbol();
        const totalSupply = ethers.formatEther(await token.totalSupply());
        const emissionCap = ethers.formatEther(await token.emissionCap());
        const totalMinted = ethers.formatEther(await token.totalMinted());
        const [feeSink, feeBps] = await marketplace.getFeeConfig();
        const nftPaused = await nft.paused();
        const stakingPaused = await staking.paused();
        const marketPaused = await marketplace.paused();

        console.log(chalk.blueBright('--- Status ---'));
        console.log(chalk.cyan(`Token: ${tokenName} (${tokenSymbol})`));
        console.log(chalk.cyan(`  Supply: ${totalSupply} / cap ${emissionCap} (totalMinted: ${totalMinted})`));
        console.log(chalk.cyan(`NFT: editions=${editionCount}, next tokenId=${nftCount}, paused=${nftPaused}`));
        console.log(chalk.cyan(`Staking: paused=${stakingPaused}`));
        console.log(chalk.cyan(`Marketplace: feeSink=${feeSink}, feeBps=${feeBps}, paused=${marketPaused}`));
        break;
      }
      case '0': {
        clearScreen();
        console.log(chalk.blue('Disconnecting...'));
        exit = true;
        break;
      }
      default: {
        console.log(chalk.red('Invalid option! Please try again.'));
      }
    }

    if (!exit) {
      await rl.question(chalk.gray('\nPress Enter to continue...'));
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
});

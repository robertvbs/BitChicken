import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import chalk from 'chalk';
import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';
import { verifyContract } from '@nomicfoundation/hardhat-verify/verify';

async function main() {
  const connection = await hre.network.create();
  const { ethers } = connection;
  const upgradesApi = await upgrades(hre, connection);

  const [deployer] = await ethers.getSigners();
  const deployerAddr = deployer.address;
  const ADMIN_WALLET = process.env.ADMIN_WALLET ?? deployerAddr;

  const rewardName = process.env.TOKEN_NAME ?? 'BitChicken Token';
  const rewardSymbol = process.env.TOKEN_SYMBOL ?? 'BCKN';
  const feeSink = process.env.FEE_SINK ?? deployerAddr;
  const platformFeeBps = BigInt(process.env.PLATFORM_FEE_BPS ?? '250');

  const isLocalnet = connection.networkName === 'localhost' || connection.networkName === 'hardhat';

  console.log(chalk.blueBright('Deploying BitChicken NFT ecosystem...'));
  console.log(chalk.cyan(`Deployer:     ${deployerAddr}`));
  console.log(chalk.cyan(`Admin wallet: ${ADMIN_WALLET}`));
  console.log(chalk.cyan(`Network:      ${connection.networkName}`));

  const Token = await ethers.getContractFactory('BitChickenToken');
  const token = await upgradesApi.deployProxy(
    Token,
    [rewardName, rewardSymbol, deployerAddr, deployerAddr, deployerAddr],
    { initializer: 'initialize' },
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const Nft = await ethers.getContractFactory('BitChickenNFT');
  const nft = await upgradesApi.deployProxy(Nft, [deployerAddr, tokenAddress], {
    initializer: 'initialize',
  });
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();

  const Staking = await ethers.getContractFactory('BitChickenStaking');
  const staking = await upgradesApi.deployProxy(Staking, [deployerAddr, nftAddress, tokenAddress], {
    initializer: 'initialize',
  });
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();

  const Marketplace = await ethers.getContractFactory('BitChickenMarketplace');
  const marketplace = await upgradesApi.deployProxy(Marketplace, [deployerAddr, nftAddress, feeSink, platformFeeBps], {
    initializer: 'initialize',
  });
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  const vrfKeyHash = process.env.VRF_KEY_HASH ?? '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc';
  const vrfCallbackGasLimit = Number(process.env.VRF_CALLBACK_GAS_LIMIT ?? '500000');
  const vrfRequestConfirmations = Number(process.env.VRF_REQUEST_CONFIRMATIONS ?? '3');

  let vrfMockAddress = '';
  let subId: bigint;
  let forgeAddress: string;

  if (isLocalnet) {
    const VRFMock = await ethers.getContractFactory('VRFCoordinatorMock');
    const vrfMock = await VRFMock.deploy(100000n, 1000000000n, 4000000000000000n);
    await vrfMock.waitForDeployment();
    vrfMockAddress = await vrfMock.getAddress();

    const createSubTx = await vrfMock.createSubscription();
    const createSubRcpt = await createSubTx.wait();
    const subCreatedLog = createSubRcpt?.logs.find(
      (l: { topics: string[] }) => l.topics[0] === ethers.id('SubscriptionCreated(uint256,address)'),
    );
    subId = subCreatedLog ? BigInt(subCreatedLog.topics[1]) : 1n;

    await (await vrfMock.fundSubscription(subId, ethers.parseEther('10'))).wait();
    console.log(chalk.cyan(`VRF Mock: ${vrfMockAddress} subId=${subId}`));

    const Forge = await ethers.getContractFactory('BitChickenForge');
    const forge = await Forge.deploy(
      vrfMockAddress,
      nftAddress,
      vrfKeyHash,
      subId,
      vrfCallbackGasLimit,
      vrfRequestConfirmations,
      ADMIN_WALLET,
    );
    await forge.waitForDeployment();
    forgeAddress = await forge.getAddress();

    await (await vrfMock.addConsumer(subId, forgeAddress)).wait();
  } else {
    const vrfCoordinator = process.env.VRF_COORDINATOR ?? '';
    const vrfSubId = BigInt(process.env.VRF_SUB_ID ?? '0');
    subId = vrfSubId;

    const Forge = await ethers.getContractFactory('BitChickenForge');
    const forge = await Forge.deploy(
      vrfCoordinator,
      nftAddress,
      vrfKeyHash,
      vrfSubId,
      vrfCallbackGasLimit,
      vrfRequestConfirmations,
      ADMIN_WALLET,
    );
    await forge.waitForDeployment();
    forgeAddress = await forge.getAddress();
  }

  await (await nft.setForge(forgeAddress)).wait();

  const minterRole = await token.MINTER_ROLE();
  await (await token.grantRole(minterRole, stakingAddress)).wait();
  await (await token.revokeRole(minterRole, deployerAddr)).wait();

  await (await token.setEmissionCap(ethers.parseEther('1000000000'))).wait();

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
  await (await nft.updateTierPrices(tierPrices)).wait();
  await (await nft.setReferralLevels([0n, 3n, 6n, 8n, 10n], [200, 400, 600, 800, 1000])).wait();
  await (await nft.setRenamePrice(ethers.parseEther('50'))).wait();
  await (await nft.setRoyalty(ADMIN_WALLET, 500)).wait();

  await (await staking.setBaseRate(1n * 10n ** 17n)).wait();
  await (await staking.setWeights(1n * 10n ** 18n, 1n * 10n ** 18n, 1n * 10n ** 18n)).wait();
  await (await staking.setClaimBurnBps(500n)).wait();
  await (await staking.setIdealPairMultiplierBps(20000n)).wait();

  const w0: [number, number, number, number, number, number, number, number, number, number] = [
    100, 100, 100, 80, 80, 60, 50, 40, 30, 20,
  ];
  const w1: [number, number, number, number, number, number, number, number, number, number] = [
    0, 0, 0, 100, 100, 100, 80, 70, 60, 50,
  ];
  const w2: [number, number, number, number, number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 50, 80, 100, 100, 100,
  ];
  const w3: [number, number, number, number, number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 10, 30, 50, 70, 100,
  ];
  const wRare: [number, number, number, number, number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 0, 2, 3, 5, 8,
  ];

  await (await nft.registerEdition('Common Hen', 'ipfs://PLACEHOLDER1', 30, 30, 30, 1, 0, 0, 0, 0, 0, w0)).wait();
  await (await nft.registerEdition('Rare Rooster', 'ipfs://PLACEHOLDER2', 60, 55, 50, 2, 0, 0, 0, 0, 0, w1)).wait();
  await (await nft.registerEdition('Epic Phoenix', 'ipfs://PLACEHOLDER3', 85, 80, 75, 3, 0, 0, 0, 0, 0, w2)).wait();
  await (
    await nft.registerEdition('Legendary Dragon Hen', 'ipfs://PLACEHOLDER4', 99, 95, 90, 4, 100, 0, 0, 0, 0, w3)
  ).wait();
  await (
    await nft.registerEdition('Golden Chick', 'ipfs://PLACEHOLDER5', 70, 65, 60, 2, 500, 0, 0, 0, 0, wRare)
  ).wait();

  console.log(chalk.cyan('Editions 1-5 registered (all Gacha; edition 5 is rare-drop only)'));

  const keepDeployerOwner = isLocalnet && process.env.KEEP_DEPLOYER_OWNER === '1';
  if (keepDeployerOwner) {
    console.log(chalk.yellow('Deployer retains ownership (local stress mode)'));
  } else {
    const defaultAdminRole = await token.DEFAULT_ADMIN_ROLE();
    await (await token.grantRole(defaultAdminRole, ADMIN_WALLET)).wait();
    await (await token.revokeRole(defaultAdminRole, deployerAddr)).wait();
    await (await nft.transferOwnership(ADMIN_WALLET)).wait();
    await (await staking.transferOwnership(ADMIN_WALLET)).wait();
    await (await marketplace.transferOwnership(ADMIN_WALLET)).wait();
    if (isLocalnet) {
      console.log(chalk.yellow('Ownership transfer started: ADMIN_WALLET is pendingOwner on NFT/Staking/Marketplace'));
      console.log(chalk.yellow('ADMIN_WALLET must call acceptOwnership() on each contract to finalise'));
    }
  }

  const tokenImpl = await upgradesApi.erc1967.getImplementationAddress(tokenAddress);
  const nftImpl = await upgradesApi.erc1967.getImplementationAddress(nftAddress);
  const stakingImpl = await upgradesApi.erc1967.getImplementationAddress(stakingAddress);
  const marketplaceImpl = await upgradesApi.erc1967.getImplementationAddress(marketplaceAddress);

  const deployed = {
    network: connection.networkName,
    admin: ADMIN_WALLET,
    token: tokenAddress,
    nft: nftAddress,
    staking: stakingAddress,
    marketplace: marketplaceAddress,
    forge: forgeAddress,
    vrfMock: vrfMockAddress,
    vrfSubId: subId.toString(),
    implementations: { token: tokenImpl, nft: nftImpl, staking: stakingImpl, marketplace: marketplaceImpl },
  };
  writeFileSync('scripts/deployed-localhost.json', `${JSON.stringify(deployed, null, 2)}\n`);

  console.log('');
  console.log(chalk.bold.bgGreen('Deploy completed successfully!'));
  console.log(chalk.cyan(`  Token:       ${chalk.yellow(tokenAddress)}`));
  console.log(chalk.cyan(`  NFT:         ${chalk.yellow(nftAddress)}`));
  console.log(chalk.cyan(`  Staking:     ${chalk.yellow(stakingAddress)}`));
  console.log(chalk.cyan(`  Marketplace: ${chalk.yellow(marketplaceAddress)}`));
  console.log(chalk.cyan(`  Forge:       ${chalk.yellow(forgeAddress)}`));
  if (vrfMockAddress) console.log(chalk.cyan(`  VRF Mock:    ${chalk.yellow(vrfMockAddress)} (subId=${subId})`));
  console.log('');

  if (!isLocalnet) {
    console.log(chalk.magenta('Waiting 30 seconds before verification...'));
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await verify('BitChickenToken', tokenAddress, []);
    await verify('BitChickenNFT', nftAddress, []);
    await verify('BitChickenStaking', stakingAddress, []);
    await verify('BitChickenMarketplace', marketplaceAddress, []);
  }
}

async function verify(label: string, address: string, constructorArgs: unknown[]) {
  console.log(chalk.magenta(`Verifying ${label}...`));
  try {
    await verifyContract({ address, constructorArgs, provider: 'etherscan' }, hre);
    console.log(chalk.green(`${label} verified successfully!`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('already verified')) {
      console.log(chalk.yellow(`${label} is already verified. Skipping...`));
    } else {
      console.warn(chalk.red(`Error verifying ${label}:`), message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.redBright('Error during deploy:'), error);
    process.exit(1);
  });

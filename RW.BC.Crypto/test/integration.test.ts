import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';
import { expect } from 'chai';
import { parseEther } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { BitChickenToken } from '../types/contracts/bitchicken-token.js';
import type { BitChickenNFT } from '../types/contracts/bitchicken-nft.js';
import type { BitChickenStaking } from '../types/contracts/bitchicken-staking.js';
import type { BitChickenMarketplace } from '../types/contracts/bitchicken-marketplace.js';
import type { BitChickenForge } from '../types/contracts/bitchicken-forge.js';
import type { VRFCoordinatorMock } from '../types/ethers-contracts/mocks/vrf-coordinator-mock.js';

const TIER_PRICES: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
  parseEther('0.01'),
  parseEther('0.02'),
  parseEther('0.03'),
  parseEther('0.04'),
  parseEther('0.05'),
  parseEther('0.06'),
  parseEther('0.07'),
  parseEther('0.08'),
  parseEther('0.09'),
  parseEther('0.10'),
];
const W_ALL: [number, number, number, number, number, number, number, number, number, number] = [
  100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
];
const W_DIRECT: [number, number, number, number, number, number, number, number, number, number] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
const KEY_HASH = '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc';
const CYCLE = 168 * 60 * 60;

describe('Integration — full on-chain flow', () => {
  let token: BitChickenToken;
  let nft: BitChickenNFT;
  let staking: BitChickenStaking;
  let marketplace: BitChickenMarketplace;
  let forge: BitChickenForge;
  let vrfMock: VRFCoordinatorMock;
  let subId: bigint;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let ethers: Awaited<ReturnType<typeof hre.network.create>>['ethers'];

  before(async () => {
    const connection = await hre.network.create();
    ethers = connection.ethers;
    const api = await upgrades(hre, connection);
    [owner, alice, bob, carol] = await ethers.getSigners();

    const TokenF = await ethers.getContractFactory('BitChickenToken');
    const tokenProxy = await api.deployProxy(
      TokenF,
      ['BitChicken', 'BCK', owner.address, owner.address, owner.address],
      { initializer: 'initialize' },
    );
    await tokenProxy.waitForDeployment();
    token = tokenProxy as unknown as BitChickenToken;
    await token.connect(owner).setEmissionCap(2n ** 128n - 1n);

    const NftF = await ethers.getContractFactory('BitChickenNFT');
    const nftProxy = await api.deployProxy(NftF, [owner.address, await token.getAddress()], {
      initializer: 'initialize',
    });
    await nftProxy.waitForDeployment();
    nft = nftProxy as unknown as BitChickenNFT;

    const StakingF = await ethers.getContractFactory('BitChickenStaking');
    const stakingProxy = await api.deployProxy(
      StakingF,
      [owner.address, await nft.getAddress(), await token.getAddress()],
      { initializer: 'initialize' },
    );
    await stakingProxy.waitForDeployment();
    staking = stakingProxy as unknown as BitChickenStaking;

    const MarketF = await ethers.getContractFactory('BitChickenMarketplace');
    const marketProxy = await api.deployProxy(MarketF, [owner.address, await nft.getAddress(), owner.address, 250n], {
      initializer: 'initialize',
    });
    await marketProxy.waitForDeployment();
    marketplace = marketProxy as unknown as BitChickenMarketplace;

    const MINTER_ROLE = await token.MINTER_ROLE();
    await token.connect(owner).grantRole(MINTER_ROLE, await staking.getAddress());

    await nft.connect(owner).updateTierPrices(TIER_PRICES);
    await nft.connect(owner).setRenamePrice(parseEther('10'));

    const VRFMockF = await ethers.getContractFactory('VRFCoordinatorMock');
    vrfMock = (await VRFMockF.deploy(100000n, 1000000000n, 4000000000000000n)) as unknown as VRFCoordinatorMock;
    await vrfMock.waitForDeployment();
    const createSub = await vrfMock.createSubscription();
    const rcpt = await createSub.wait();
    const log = rcpt?.logs.find(
      (l: { topics: string[] }) => l.topics[0] === ethers.id('SubscriptionCreated(uint256,address)'),
    );
    subId = log ? BigInt(log.topics[1]) : 1n;
    await vrfMock.fundSubscription(subId, parseEther('100'));

    const ForgeF = await ethers.getContractFactory('BitChickenForge');
    forge = (await ForgeF.deploy(
      await vrfMock.getAddress(),
      await nft.getAddress(),
      KEY_HASH,
      subId,
      500000,
      3,
      owner.address,
    )) as unknown as BitChickenForge;
    await forge.waitForDeployment();
    await vrfMock.addConsumer(subId, await forge.getAddress());
    await nft.connect(owner).setForge(await forge.getAddress());

    await nft.connect(owner).registerEdition('Common Hen', 'ipfs://CID1', 30, 40, 50, 1, 0, 0, 0, 0, 0, W_ALL);
    await nft.connect(owner).registerEdition('Rare Rooster', 'ipfs://CID2', 60, 70, 80, 2, 0, 0, 0, 0, 0, W_ALL);
    await nft.connect(owner).registerEdition('Golden Chick', 'ipfs://CID3', 70, 65, 60, 2, 500, 0, 0, 0, 0, W_DIRECT);
    await nft.connect(owner).registerEdition('Common Hen Clone', 'ipfs://CID1C', 30, 40, 50, 1, 0, 0, 0, 0, 0, W_ALL);

    await staking.connect(owner).setBaseRate(5n * 10n ** 20n);
    await staking.connect(owner).setWeights(parseEther('1'), parseEther('1'), parseEther('1'));
    await staking.connect(owner).setClaimBurnBps(500n);
    await staking.connect(owner).setIdealPairMultiplierBps(20000n);
  });

  async function driveForge(signer: HardhatEthersSigner, tier: number, name: string): Promise<bigint> {
    const price = TIER_PRICES[tier];
    const reqTx = await forge.connect(signer).requestObtain(tier, 0n, name, { value: price });
    const reqRcpt = await reqTx.wait();
    const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
    const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
    const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;
    await vrfMock.fulfillRandomWords(requestId, await forge.getAddress());
    return (await nft.nextId()) - 1n;
  }

  async function forgeMintDirect(
    recipient: HardhatEthersSigner,
    editionId: bigint,
    gender: number,
    name: string,
  ): Promise<bigint> {
    await nft.connect(owner).setForge(owner.address);
    const nextId = await nft.nextId();
    await nft.connect(owner).forgeMint(recipient.address, editionId, gender, name, 0n);
    await nft.connect(owner).setForge(await forge.getAddress());
    return nextId;
  }

  describe('Gacha forge: requestObtain → fulfillRandomWords → NFT minted', () => {
    it('mints an NFT to alice with a valid catalog edition', async () => {
      const tokenId = await driveForge(alice, 0, 'AliceHen');
      expect(await nft.ownerOf(tokenId)).to.equal(alice.address);
      const eid = await nft.editionOf(tokenId);
      expect(eid).to.be.within(1n, 2n);
    });

    it('minted NFT attributes exactly match the edition stats', async () => {
      const tokenId = await driveForge(alice, 0, 'AliceHen2');
      const eid = await nft.editionOf(tokenId);
      const edition = await nft.getEdition(eid);
      const [h, s, m] = await nft.attributesOf(tokenId);
      expect(h).to.equal(edition.health);
      expect(s).to.equal(edition.skill);
      expect(m).to.equal(edition.morale);
    });

    it('gender is set (0 or 1)', async () => {
      const tokenId = await driveForge(alice, 0, 'AliceHen3');
      const [, gender] = await nft.tokenData(tokenId);
      expect(gender).to.be.oneOf([0n, 1n]);
    });

    it('edition minted counter increments', async () => {
      const tokenId = await driveForge(alice, 0, 'AliceHen4');
      const eid = await nft.editionOf(tokenId);
      const edition = await nft.getEdition(eid);
      expect(edition.minted).to.be.gte(1n);
    });
  });

  describe('Ideal pair: stake same-edition pair → 2x yield vs non-ideal', () => {
    it('same-edition pair earns exactly 2x vs different-edition pair', async () => {
      const maleIdeal = await forgeMintDirect(alice, 1n, 0, 'IdealMale');
      const femaleIdeal = await forgeMintDirect(alice, 1n, 1, 'IdealFemale');
      const maleDiff = await forgeMintDirect(alice, 1n, 0, 'DiffMale');
      const femaleDiff = await forgeMintDirect(alice, 4n, 1, 'DiffFemale');

      await nft.connect(alice).setApprovalForAll(await staking.getAddress(), true);
      const stakeTx1 = await staking.connect(alice).stakePair(maleIdeal, femaleIdeal);
      const stakeRcpt1 = await stakeTx1.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const stakeLog1 = stakeRcpt1?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const idealPairId = staking.interface.decodeEventLog('PairStaked', stakeLog1!.data, stakeLog1!.topics).pairId;

      const stakeTx2 = await staking.connect(alice).stakePair(maleDiff, femaleDiff);
      const stakeRcpt2 = await stakeTx2.wait();
      const stakeLog2 = stakeRcpt2?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const normalPairId = staking.interface.decodeEventLog('PairStaked', stakeLog2!.data, stakeLog2!.topics).pairId;

      await ethers.provider.send('evm_increaseTime', [CYCLE + 1]);
      await ethers.provider.send('evm_mine', []);

      const pendingIdeal = await staking.pendingOf(idealPairId);
      const pendingNormal = await staking.pendingOf(normalPairId);

      expect(pendingIdeal).to.be.gt(0n);
      expect(pendingNormal).to.be.gt(0n);
      const ratio = (pendingIdeal * 10000n) / pendingNormal;
      expect(ratio).to.be.within(19900n, 20100n);

      const idealPairData = await staking.getPair(idealPairId);
      const normalPairData = await staking.getPair(normalPairId);
      expect(idealPairData.matched).to.equal(true);
      expect(normalPairData.matched).to.equal(false);
    });
  });

  describe('Rename: burns BCKN', () => {
    it('rename burns exactly renamePrice BCKN and updates the name', async () => {
      const tokenId = await forgeMintDirect(alice, 1n, 0, 'BeforeName');

      const MINTER_ROLE = await token.MINTER_ROLE();
      await token.connect(owner).grantRole(MINTER_ROLE, owner.address);
      await token.connect(owner).mint(alice.address, parseEther('100'));
      await token.connect(owner).revokeRole(MINTER_ROLE, owner.address);

      await token.connect(alice).approve(await nft.getAddress(), parseEther('10'));
      const supplyBefore = await token.totalSupply();
      await nft.connect(alice).rename(tokenId, 'AfterName');
      const supplyAfter = await token.totalSupply();

      expect(supplyBefore - supplyAfter).to.equal(parseEther('10'));
      const [, , name] = await nft.tokenData(tokenId);
      expect(name).to.equal('AfterName');
    });
  });

  describe('Referral: forging with a referrer code rewards the referrer in BNB', () => {
    it('the referrer accrues pending BNB (2% at level 00) on the referred buyer first egg', async () => {
      await nft.connect(carol).registerReferrer();
      const code = await nft.getReferrerCode(carol.address);

      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(bob).requestObtain(0, code, 'BobHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;
      await vrfMock.fulfillRandomWords(requestId, await forge.getAddress());

      expect(await forge.pendingReferralBnb(carol.address)).to.equal((price * 200n) / 10000n);
    });
  });

  describe('Marketplace: list → approve → buy (fix for old bug #3)', () => {
    it('seller lists NFT, buyer approves and buys successfully', async () => {
      const tokenId = await forgeMintDirect(alice, 1n, 0, 'ForSale');
      const price = parseEther('0.1');

      await nft.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await expect(marketplace.connect(alice).list(tokenId, price))
        .to.emit(marketplace, 'Listed')
        .withArgs(tokenId, alice.address, price);

      const aliceBefore = await ethers.provider.getBalance(alice.address);
      await marketplace.connect(bob).obtain(tokenId, { value: price });
      const aliceAfter = await ethers.provider.getBalance(alice.address);

      expect(await nft.ownerOf(tokenId)).to.equal(bob.address);
      expect(aliceAfter).to.be.gt(aliceBefore);
    });

    it('list reverts NotApproved when marketplace not approved', async () => {
      const tokenId = await forgeMintDirect(alice, 1n, 0, 'NotApproved');
      await nft.connect(alice).setApprovalForAll(await marketplace.getAddress(), false);
      await expect(marketplace.connect(alice).list(tokenId, parseEther('0.1'))).to.be.revertedWithCustomError(
        marketplace,
        'NotApproved',
      );
    });
  });

  describe('tokenURI: pure-view with IPFS art', () => {
    it('tokenURI contains the edition artURI and fixed stats', async () => {
      const tokenId = await forgeMintDirect(alice, 1n, 0, 'URITest');
      const uri = await nft.tokenURI(tokenId);
      expect(uri.startsWith('data:application/json;base64,')).to.be.true;
      const decoded = Buffer.from(uri.slice('data:application/json;base64,'.length), 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as {
        image: string;
        attributes: { trait_type: string; value: unknown }[];
      };
      expect(parsed.image).to.equal('ipfs://CID1');
      expect(parsed.attributes.find((a) => a.trait_type === 'Health')?.value).to.equal(30);
    });
  });

  describe('supply conservation', () => {
    it('minted counter never exceeds maxSupply (via forgeMint)', async () => {
      await nft.connect(owner).registerEdition('Limited', 'ipfs://LTD', 50, 50, 50, 1, 2, 0, 0, 0, 0, W_ALL);
      const edId = await nft.editionCount();

      await forgeMintDirect(alice, edId, 0, 'First');
      await forgeMintDirect(alice, edId, 1, 'Second');

      const e = await nft.getEdition(edId);
      expect(e.minted).to.equal(2n);
      expect(e.minted).to.be.lte(e.maxSupply);

      await nft.connect(owner).setForge(owner.address);
      await expect(nft.connect(owner).forgeMint(alice.address, edId, 0, 'Third', 0n)).to.be.revertedWithCustomError(
        nft,
        'EditionSoldOut',
      );
      await nft.connect(owner).setForge(await forge.getAddress());
    });
  });

  describe('Marketplace swap: proposeSwap → acceptSwap', () => {
    it('atomic NFT swap without BNB leg: both tokens exchange owners', async () => {
      const aliceToken = await forgeMintDirect(alice, 1n, 0, 'AliceSwap');
      const bobToken = await forgeMintDirect(bob, 2n, 1, 'BobSwap');

      await nft.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await nft.connect(bob).setApprovalForAll(await marketplace.getAddress(), true);

      const proposeTx = await marketplace.connect(alice).proposeSwap(aliceToken, bobToken);
      const proposeRcpt = await proposeTx.wait();
      const proposeTopic = ethers.id('SwapProposed(uint256,address,uint256,uint256,uint96)');
      const proposeLog = proposeRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === proposeTopic);
      const swapId = proposeLog ? BigInt(proposeLog.topics[1]) : 1n;

      const swapBefore = await marketplace.getSwap(swapId);
      expect(swapBefore.proposer).to.equal(alice.address);
      expect(swapBefore.offeredId).to.equal(aliceToken);
      expect(swapBefore.wantedId).to.equal(bobToken);

      await marketplace.connect(bob).acceptSwap(swapId);

      expect(await nft.ownerOf(aliceToken)).to.equal(bob.address);
      expect(await nft.ownerOf(bobToken)).to.equal(alice.address);

      const swapAfter = await marketplace.getSwap(swapId);
      expect(swapAfter.proposer).to.equal(ethers.ZeroAddress);
    });

    it('swap with BNB leg: acceptor receives BNB sweetener', async () => {
      const aliceToken = await forgeMintDirect(alice, 1n, 0, 'AliceBNB');
      const bobToken = await forgeMintDirect(bob, 2n, 1, 'BobBNB');

      await nft.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await nft.connect(bob).setApprovalForAll(await marketplace.getAddress(), true);

      const bnbLeg = parseEther('0.1');
      const proposeTx = await marketplace.connect(alice).proposeSwap(aliceToken, bobToken, { value: bnbLeg });
      const proposeRcpt = await proposeTx.wait();
      const proposeTopic = ethers.id('SwapProposed(uint256,address,uint256,uint256,uint96)');
      const proposeLog = proposeRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === proposeTopic);
      const activeSwapId = proposeLog ? BigInt(proposeLog.topics[1]) : 1n;

      const bobBalBefore = await ethers.provider.getBalance(bob.address);
      const acceptTx = await marketplace.connect(bob).acceptSwap(activeSwapId);
      const acceptRcpt = await acceptTx.wait();
      const gasUsed = acceptRcpt ? acceptRcpt.gasUsed * acceptRcpt.gasPrice : 0n;
      const bobBalAfter = await ethers.provider.getBalance(bob.address);

      expect(await nft.ownerOf(aliceToken)).to.equal(bob.address);
      expect(await nft.ownerOf(bobToken)).to.equal(alice.address);
      expect(bobBalAfter + gasUsed).to.be.gte(bobBalBefore + bnbLeg);
    });

    it('emits SwapAccepted event with correct participants', async () => {
      const aliceToken = await forgeMintDirect(alice, 1n, 0, 'AliceEvt');
      const bobToken = await forgeMintDirect(bob, 2n, 1, 'BobEvt');

      await nft.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await nft.connect(bob).setApprovalForAll(await marketplace.getAddress(), true);

      const proposeTx = await marketplace.connect(alice).proposeSwap(aliceToken, bobToken);
      const proposeRcpt = await proposeTx.wait();
      const proposeTopic = ethers.id('SwapProposed(uint256,address,uint256,uint256,uint96)');
      const proposeLog = proposeRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === proposeTopic);
      const swapId = proposeLog ? BigInt(proposeLog.topics[1]) : 1n;

      await expect(marketplace.connect(bob).acceptSwap(swapId))
        .to.emit(marketplace, 'SwapAccepted')
        .withArgs(swapId, alice.address, bob.address, aliceToken, bobToken);
    });

    it('acceptSwap reverts SwapNotFound for unknown id', async () => {
      await expect(marketplace.connect(bob).acceptSwap(9999n)).to.be.revertedWithCustomError(
        marketplace,
        'SwapNotFound',
      );
    });

    it('acceptSwap reverts NotWantedOwner when caller does not own the wanted token', async () => {
      const aliceToken = await forgeMintDirect(alice, 1n, 0, 'AliceWanted');
      const bobToken = await forgeMintDirect(bob, 2n, 1, 'BobWanted');

      await nft.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);

      const proposeTx = await marketplace.connect(alice).proposeSwap(aliceToken, bobToken);
      const proposeRcpt = await proposeTx.wait();
      const proposeTopic = ethers.id('SwapProposed(uint256,address,uint256,uint256,uint96)');
      const proposeLog = proposeRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === proposeTopic);
      const swapId = proposeLog ? BigInt(proposeLog.topics[1]) : 1n;

      await expect(marketplace.connect(carol).acceptSwap(swapId)).to.be.revertedWithCustomError(
        marketplace,
        'NotWantedOwner',
      );
    });
  });

  describe('Staking unstake: stakePair → advance time → unstakePair returns NFTs and claims yield', () => {
    it('unstakePair returns both NFTs to staker and auto-claims elapsed cycles', async () => {
      const maleId = await forgeMintDirect(alice, 1n, 0, 'UnstakeMale');
      const femaleId = await forgeMintDirect(alice, 1n, 1, 'UnstakeFemale');

      await nft.connect(alice).setApprovalForAll(await staking.getAddress(), true);

      const stakeTx = await staking.connect(alice).stakePair(maleId, femaleId);
      const stakeRcpt = await stakeTx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const stakeLog = stakeRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const pairId = staking.interface.decodeEventLog('PairStaked', stakeLog!.data, stakeLog!.topics).pairId;

      expect(await staking.isStaked(maleId)).to.equal(true);
      expect(await staking.isStaked(femaleId)).to.equal(true);

      await ethers.provider.send('evm_increaseTime', [CYCLE + 1]);
      await ethers.provider.send('evm_mine', []);

      const pendingBefore = await staking.pendingOf(pairId);
      expect(pendingBefore).to.be.gt(0n);

      const tokenSupplyBefore = await token.totalSupply();

      const unstakeTx = await staking.connect(alice).unstakePair(pairId);
      await expect(unstakeTx).to.emit(staking, 'PairUnstaked').withArgs(alice.address, pairId, maleId, femaleId);
      await expect(unstakeTx).to.emit(staking, 'YieldClaimed');

      expect(await nft.ownerOf(maleId)).to.equal(alice.address);
      expect(await nft.ownerOf(femaleId)).to.equal(alice.address);
      expect(await staking.isStaked(maleId)).to.equal(false);
      expect(await staking.isStaked(femaleId)).to.equal(false);

      const tokenSupplyAfter = await token.totalSupply();
      expect(tokenSupplyAfter).to.be.gt(tokenSupplyBefore);

      const pairAfter = await staking.getPair(pairId);
      expect(pairAfter.owner).to.equal(ethers.ZeroAddress);
    });

    it('unstakePair with zero elapsed cycles returns NFTs without emitting YieldClaimed', async () => {
      const maleId = await forgeMintDirect(alice, 1n, 0, 'NoYieldMale');
      const femaleId = await forgeMintDirect(alice, 1n, 1, 'NoYieldFemale');

      await nft.connect(alice).setApprovalForAll(await staking.getAddress(), true);

      const stakeTx = await staking.connect(alice).stakePair(maleId, femaleId);
      const stakeRcpt = await stakeTx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const stakeLog = stakeRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const pairId = staking.interface.decodeEventLog('PairStaked', stakeLog!.data, stakeLog!.topics).pairId;

      await expect(staking.connect(alice).unstakePair(pairId))
        .to.emit(staking, 'PairUnstaked')
        .and.not.to.emit(staking, 'YieldClaimed');

      expect(await nft.ownerOf(maleId)).to.equal(alice.address);
      expect(await nft.ownerOf(femaleId)).to.equal(alice.address);
    });

    it('unstakePair reverts NotPairOwner when caller is not the staker', async () => {
      const maleId = await forgeMintDirect(alice, 1n, 0, 'NotOwnerMale');
      const femaleId = await forgeMintDirect(alice, 1n, 1, 'NotOwnerFemale');

      await nft.connect(alice).setApprovalForAll(await staking.getAddress(), true);
      const stakeTx = await staking.connect(alice).stakePair(maleId, femaleId);
      const stakeRcpt = await stakeTx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const stakeLog = stakeRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const pairId = staking.interface.decodeEventLog('PairStaked', stakeLog!.data, stakeLog!.topics).pairId;

      await expect(staking.connect(bob).unstakePair(pairId)).to.be.revertedWithCustomError(staking, 'NotPairOwner');

      await staking.connect(alice).unstakePair(pairId);
    });
  });

  describe('VRF stale refund: requestObtain → advance blocks → cancelStaleRequest → claimRefund', () => {
    it('buyer recovers BNB after STALE_BLOCKS without fulfillment', async () => {
      const staleBlocks = await forge.STALE_BLOCKS();
      const price = TIER_PRICES[0];

      const reqTx = await forge.connect(bob).requestObtain(0, 0n, 'StaleHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

      const req = await forge.requests(requestId);
      expect(req.buyer).to.equal(bob.address);

      await expect(forge.connect(bob).cancelStaleRequest(requestId)).to.be.revertedWithCustomError(
        forge,
        'RequestNotStale',
      );

      for (let i = 0; i < Number(staleBlocks) + 1; i++) {
        await ethers.provider.send('evm_mine', []);
      }

      const cancelTx = await forge.connect(bob).cancelStaleRequest(requestId);
      await expect(cancelTx).to.emit(forge, 'RequestCancelled').withArgs(bob.address, requestId, price);

      const pendingRefund = await forge.pendingRefund(bob.address);
      expect(pendingRefund).to.equal(price);

      const bobBalBefore = await ethers.provider.getBalance(bob.address);
      const claimTx = await forge.connect(bob).claimRefund();
      const claimRcpt = await claimTx.wait();
      const gasUsed = claimRcpt ? claimRcpt.gasUsed * claimRcpt.gasPrice : 0n;
      const bobBalAfter = await ethers.provider.getBalance(bob.address);

      await expect(claimTx).to.emit(forge, 'RefundClaimed').withArgs(bob.address, price);
      expect(bobBalAfter + gasUsed).to.be.closeTo(bobBalBefore + price, parseEther('0.001'));

      expect(await forge.pendingRefund(bob.address)).to.equal(0n);
    });

    it('cancelStaleRequest reverts NotRequestOwner when another address tries to cancel', async () => {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(alice).requestObtain(0, 0n, 'AliceStale', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

      const staleBlocks = await forge.STALE_BLOCKS();
      for (let i = 0; i < Number(staleBlocks) + 1; i++) {
        await ethers.provider.send('evm_mine', []);
      }

      await expect(forge.connect(bob).cancelStaleRequest(requestId)).to.be.revertedWithCustomError(
        forge,
        'NotRequestOwner',
      );

      await vrfMock.fulfillRandomWords(requestId, await forge.getAddress());
    });
  });

  describe('Admin actions: per-action assertions', () => {
    describe('setRoyalty: reflected in royaltyInfo', () => {
      it('owner sets royalty and royaltyInfo returns correct receiver and amount', async () => {
        const tokenId = await forgeMintDirect(alice, 1n, 0, 'RoyaltyToken');
        const salePrice = parseEther('1.0');

        await nft.connect(owner).setRoyalty(carol.address, 500n);

        const [receiver, amount] = await nft.royaltyInfo(tokenId, salePrice);
        expect(receiver).to.equal(carol.address);
        expect(amount).to.equal((salePrice * 500n) / 10000n);
      });

      it('royalty is reflected in marketplace buy fee split', async () => {
        await nft.connect(owner).setRoyalty(carol.address, 500n);
        const tokenId = await forgeMintDirect(alice, 1n, 0, 'RoyaltySale');
        const price = parseEther('1.0');

        await nft.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
        await marketplace.connect(alice).list(tokenId, price);

        const carolBefore = await ethers.provider.getBalance(carol.address);
        await marketplace.connect(bob).obtain(tokenId, { value: price });
        const carolAfter = await ethers.provider.getBalance(carol.address);

        const royaltyExpected = (price * 500n) / 10000n;
        expect(carolAfter - carolBefore).to.equal(royaltyExpected);
      });
    });

    describe('setPlatformFee: reflected in buy fee split', () => {
      it('owner updates platform fee and next buy splits BNB correctly', async () => {
        const newFeeBps = 100n;
        const feeSinkAddress = carol.address;
        await marketplace.connect(owner).setPlatformFee(feeSinkAddress, newFeeBps);

        const [configSink, configBps] = await marketplace.getFeeConfig();
        expect(configSink).to.equal(feeSinkAddress);
        expect(configBps).to.equal(newFeeBps);

        const tokenId = await forgeMintDirect(alice, 1n, 0, 'FeeTest');
        const price = parseEther('1.0');

        await nft.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
        await marketplace.connect(alice).list(tokenId, price);

        const carolBefore = await ethers.provider.getBalance(carol.address);
        await marketplace.connect(bob).obtain(tokenId, { value: price });
        const carolAfter = await ethers.provider.getBalance(carol.address);

        const platformFeeExpected = (price * newFeeBps) / 10000n;
        expect(carolAfter - carolBefore).to.be.gte(platformFeeExpected);

        await marketplace.connect(owner).setPlatformFee(owner.address, 250n);
      });
    });

    describe('setEmissionCap: mint beyond cap reverts', () => {
      it('minting exactly at cap succeeds then next mint reverts EmissionCapExceeded', async () => {
        const MINTER_ROLE = await token.MINTER_ROLE();
        await token.connect(owner).grantRole(MINTER_ROLE, owner.address);

        const currentMinted = await token.totalMinted();
        const tightCap = currentMinted + parseEther('1');
        await token.connect(owner).setEmissionCap(tightCap);

        await token.connect(owner).mint(alice.address, parseEther('1'));

        await expect(token.connect(owner).mint(alice.address, 1n)).to.be.revertedWithCustomError(
          token,
          'EmissionCapExceeded',
        );

        await token.connect(owner).setEmissionCap(2n ** 128n - 1n);
        await token.connect(owner).revokeRole(MINTER_ROLE, owner.address);
      });
    });

    describe('pause / unpause: gates forge, stake, and list', () => {
      it('pausing NFT blocks forgeMint (via forge)', async () => {
        await nft.connect(owner).pause();

        const price = TIER_PRICES[0];
        const reqTx = await forge.connect(alice).requestObtain(0, 0n, 'PausedForge', { value: price });
        const reqRcpt = await reqTx.wait();
        const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
        const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
        const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

        const nftBefore = await nft.nextId();
        await vrfMock.fulfillRandomWords(requestId, await forge.getAddress());
        const nftAfter = await nft.nextId();
        expect(nftAfter).to.equal(nftBefore);

        await nft.connect(owner).unpause();
      });

      it('pausing staking blocks stakePair', async () => {
        await staking.connect(owner).pause();

        const maleId = await forgeMintDirect(alice, 1n, 0, 'PausedMale');
        const femaleId = await forgeMintDirect(alice, 1n, 1, 'PausedFemale');
        await nft.connect(alice).setApprovalForAll(await staking.getAddress(), true);

        await expect(staking.connect(alice).stakePair(maleId, femaleId)).to.be.revertedWithCustomError(
          staking,
          'EnforcedPause',
        );

        await staking.connect(owner).unpause();
      });

      it('pausing marketplace blocks list', async () => {
        await marketplace.connect(owner).pause();

        const tokenId = await forgeMintDirect(alice, 1n, 0, 'PausedList');
        await nft.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);

        await expect(marketplace.connect(alice).list(tokenId, parseEther('0.1'))).to.be.revertedWithCustomError(
          marketplace,
          'EnforcedPause',
        );

        await marketplace.connect(owner).unpause();
      });
    });

    describe('updateTierPrices: changes required value for requestObtain', () => {
      it('after updateTierPrices the old price is rejected and new price accepted', async () => {
        const oldPrice = TIER_PRICES[0];
        const newPrice = parseEther('0.03');

        const newPrices: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
          newPrice,
          parseEther('0.04'),
          parseEther('0.05'),
          parseEther('0.06'),
          parseEther('0.07'),
          parseEther('0.08'),
          parseEther('0.09'),
          parseEther('0.10'),
          parseEther('0.11'),
          parseEther('0.12'),
        ];
        await nft.connect(owner).updateTierPrices(newPrices);

        await expect(
          forge.connect(alice).requestObtain(0, 0n, 'WrongPrice', { value: oldPrice }),
        ).to.be.revertedWithCustomError(forge, 'IncorrectPayment');

        const reqTx = await forge.connect(alice).requestObtain(0, 0n, 'RightPrice', { value: newPrice });
        const reqRcpt = await reqTx.wait();
        const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
        const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
        const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;
        await vrfMock.fulfillRandomWords(requestId, await forge.getAddress());

        await nft.connect(owner).updateTierPrices(TIER_PRICES);
      });
    });
  });

  describe('A6: ideal vs non-ideal pair — exact 2x yield ratio end-to-end', () => {
    it('ideal pair (same edition) nets exactly 2x vs non-ideal pair after 1 cycle', async () => {
      const SCALE = parseEther('1');
      const BASE_RATE_VAL = 5n * 10n ** 20n;
      const WEIGHT_VAL = parseEther('1');
      const BURN_BPS_VAL = 500n;
      const MULTIPLIER_BPS = 20000n;

      const maleIdeal = await forgeMintDirect(bob, 1n, 0, 'A6IdealMale');
      const femaleIdeal = await forgeMintDirect(bob, 1n, 1, 'A6IdealFemale');
      const maleDiff = await forgeMintDirect(bob, 1n, 0, 'A6DiffMale');
      const femaleDiff = await forgeMintDirect(bob, 4n, 1, 'A6DiffFemale');

      await nft.connect(bob).setApprovalForAll(await staking.getAddress(), true);

      const stakeTopic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');

      const tx1 = await staking.connect(bob).stakePair(maleIdeal, femaleIdeal);
      const r1 = await tx1.wait();
      const l1 = r1?.logs.find((l: { topics: string[] }) => l.topics[0] === stakeTopic);
      const idealPairId = staking.interface.decodeEventLog('PairStaked', l1!.data, l1!.topics).pairId as bigint;

      const tx2 = await staking.connect(bob).stakePair(maleDiff, femaleDiff);
      const r2 = await tx2.wait();
      const l2 = r2?.logs.find((l: { topics: string[] }) => l.topics[0] === stakeTopic);
      const diffPairId = staking.interface.decodeEventLog('PairStaked', l2!.data, l2!.topics).pairId as bigint;

      await ethers.provider.send('evm_increaseTime', [CYCLE + 1]);
      await ethers.provider.send('evm_mine', []);

      const editionCommon = await nft.getEdition(1n);
      const editionClone = await nft.getEdition(4n);

      const h1 = BigInt(editionCommon.health);
      const s1 = BigInt(editionCommon.skill);
      const m1 = BigInt(editionCommon.morale);
      const h2c = BigInt(editionClone.health);
      const s2c = BigInt(editionClone.skill);
      const m2c = BigInt(editionClone.morale);

      const scoreIdeal = WEIGHT_VAL * (h1 + h1) + WEIGHT_VAL * (s1 + s1) + WEIGHT_VAL * (m1 + m1);
      const baseIdeal = (BASE_RATE_VAL * scoreIdeal) / SCALE;
      const rpcIdeal = (baseIdeal * MULTIPLIER_BPS) / 10000n;
      const grossIdeal = rpcIdeal;
      const burnedIdeal = (grossIdeal * BURN_BPS_VAL) / 10000n;
      const expectedNetIdeal = grossIdeal - burnedIdeal;

      const scoreDiff = WEIGHT_VAL * (h1 + h2c) + WEIGHT_VAL * (s1 + s2c) + WEIGHT_VAL * (m1 + m2c);
      const baseDiff = (BASE_RATE_VAL * scoreDiff) / SCALE;
      const rpcDiff = (baseDiff * 10000n) / 10000n;
      const grossDiff = rpcDiff;
      const burnedDiff = (grossDiff * BURN_BPS_VAL) / 10000n;
      const expectedNetDiff = grossDiff - burnedDiff;

      const claimTopic = ethers.id('YieldClaimed(address,uint256,uint256,uint256,uint256,uint256)');

      const claimTx1 = await staking.connect(bob).claim(idealPairId);
      const claimR1 = await claimTx1.wait();
      const claimL1 = claimR1?.logs.find((l: { topics: string[] }) => l.topics[0] === claimTopic);
      const decodedIdeal = staking.interface.decodeEventLog('YieldClaimed', claimL1!.data, claimL1!.topics);

      const claimTx2 = await staking.connect(bob).claim(diffPairId);
      const claimR2 = await claimTx2.wait();
      const claimL2 = claimR2?.logs.find((l: { topics: string[] }) => l.topics[0] === claimTopic);
      const decodedDiff = staking.interface.decodeEventLog('YieldClaimed', claimL2!.data, claimL2!.topics);

      expect(decodedIdeal.net).to.equal(expectedNetIdeal);
      expect(decodedDiff.net).to.equal(expectedNetDiff);
      expect(decodedIdeal.net).to.equal(decodedDiff.net * 2n);
    });
  });

  describe('B2: referral E2E — forge path, referrer accrues BNB and claims the exact amount', () => {
    it('direct referrer accrues 2% in BNB on the first egg, nothing on the second, then claims', async () => {
      const price = TIER_PRICES[0];
      const expected = (price * 200n) / 10000n; // level 00 (0 referees) → 2%
      const forgeTopic = ethers.id('ForgeRequested(address,uint256,uint8)');

      await nft.connect(owner).registerReferrer();
      const codeOwner = await nft.getReferrerCode(owner.address);

      async function forgeWith(buyer: HardhatEthersSigner, name: string): Promise<void> {
        const reqTx = await forge.connect(buyer).requestObtain(0, codeOwner, name, { value: price });
        const rcpt = await reqTx.wait();
        const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === forgeTopic);
        const requestId = log ? BigInt(log.topics[2]) : 0n;
        await vrfMock.fulfillRandomWords(requestId, await forge.getAddress());
      }

      await forgeWith(alice, 'B2Alice1');
      expect(await forge.pendingReferralBnb(owner.address)).to.equal(expected);

      // Alice's second egg pays nothing more — she is already linked.
      await forgeWith(alice, 'B2Alice2');
      expect(await forge.pendingReferralBnb(owner.address)).to.equal(expected);

      await expect(forge.connect(owner).claimReferralBnb())
        .to.emit(forge, 'ReferralBnbClaimed')
        .withArgs(owner.address, expected);
      expect(await forge.pendingReferralBnb(owner.address)).to.equal(0n);
    });
  });
});

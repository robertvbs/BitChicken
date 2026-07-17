import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';
import { expect } from 'chai';
import { parseEther, ZeroAddress } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { BitChickenToken } from '../types/contracts/bitchicken-token.js';
import type { BitChickenNFT } from '../types/contracts/bitchicken-nft.js';
import type { BitChickenStaking } from '../types/contracts/bitchicken-staking.js';
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
const KEY_HASH = '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc';
const CYCLE = 168 * 60 * 60;
const BASE_RATE = parseEther('1');
const WEIGHT = parseEther('1');
const BURN_BPS = 500n;

describe('BitChickenStaking', () => {
  let token: BitChickenToken;
  let nft: BitChickenNFT;
  let staking: BitChickenStaking;
  let vrfMock: VRFCoordinatorMock;
  let subId: bigint;
  let forgeAddr: string;
  let owner: HardhatEthersSigner;
  let staker: HardhatEthersSigner;
  let staker2: HardhatEthersSigner;
  let ethers: Awaited<ReturnType<typeof hre.network.create>>['ethers'];

  async function deployAll() {
    const connection = await hre.network.create();
    ethers = connection.ethers;
    const api = await upgrades(hre, connection);
    [owner, staker, staker2] = await ethers.getSigners();

    const TokenF = await ethers.getContractFactory('BitChickenToken');
    const tokenProxy = await api.deployProxy(
      TokenF,
      ['BitChicken', 'BCK', owner.address, owner.address, owner.address],
      { initializer: 'initialize' },
    );
    await tokenProxy.waitForDeployment();
    token = tokenProxy as unknown as BitChickenToken;
    await token.connect(owner).setEmissionCap(parseEther('1000000000'));

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

    const MINTER_ROLE = await token.MINTER_ROLE();
    await token.connect(owner).grantRole(MINTER_ROLE, await staking.getAddress());
    await token.connect(owner).grantRole(MINTER_ROLE, await nft.getAddress());

    await nft.connect(owner).updateTierPrices(TIER_PRICES);

    const VRFMockF = await ethers.getContractFactory('VRFCoordinatorMock');
    vrfMock = (await VRFMockF.deploy(100000n, 1000000000n, 4000000000000000n)) as unknown as VRFCoordinatorMock;
    await vrfMock.waitForDeployment();
    const createSub = await vrfMock.createSubscription();
    const rcpt = await createSub.wait();
    const log = rcpt?.logs.find(
      (l: { topics: string[] }) => l.topics[0] === ethers.id('SubscriptionCreated(uint256,address)'),
    );
    subId = log ? BigInt(log.topics[1]) : 1n;
    await vrfMock.fundSubscription(subId, parseEther('10'));

    const ForgeF = await ethers.getContractFactory('BitChickenForge');
    const forge = await ForgeF.deploy(
      await vrfMock.getAddress(),
      await nft.getAddress(),
      KEY_HASH,
      subId,
      500000,
      3,
      owner.address,
    );
    await forge.waitForDeployment();
    forgeAddr = await forge.getAddress();
    await vrfMock.addConsumer(subId, forgeAddr);
    await nft.connect(owner).setForge(forgeAddr);

    await nft.connect(owner).registerEdition('Common Hen', 'ipfs://CID1', 30, 40, 50, 1, 0, 0, 0, 0, 0, W_ALL);
    await nft.connect(owner).registerEdition('Rare Rooster', 'ipfs://CID2', 60, 70, 80, 2, 0, 0, 0, 0, 0, W_ALL);

    await staking.connect(owner).setBaseRate(BASE_RATE);
    await staking.connect(owner).setWeights(WEIGHT, WEIGHT, WEIGHT);
    await staking.connect(owner).setClaimBurnBps(BURN_BPS);
    await staking.connect(owner).setIdealPairMultiplierBps(20000n);
  }

  async function forgeNFTs(signer: HardhatEthersSigner, count: number, editionId?: bigint): Promise<bigint[]> {
    const forge = (await ethers.getContractFactory('BitChickenForge')).attach(forgeAddr);
    const tokenIds: bigint[] = [];

    for (let i = 0; i < count; i++) {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(signer).requestObtain(0, 0n, `Token${i}`, { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : BigInt(i + 1);
      await vrfMock.fulfillRandomWords(requestId, forgeAddr);
      tokenIds.push((await nft.nextId()) - 1n);
    }
    return tokenIds;
  }

  async function forgePairWithEditions(
    signer: HardhatEthersSigner,
    maleEditionId: bigint,
    femaleEditionId: bigint,
  ): Promise<{ maleId: bigint; femaleId: bigint }> {
    await nft.connect(owner).setForge(owner.address);
    const nextId = await nft.nextId();
    await nft.connect(owner).forgeMint(signer.address, maleEditionId, 0, 'Male', 0n);
    await nft.connect(owner).forgeMint(signer.address, femaleEditionId, 1, 'Female', 0n);
    await nft.connect(owner).setForge(forgeAddr);
    const maleId = nextId;
    const femaleId = nextId + 1n;
    await nft.connect(signer).setApprovalForAll(await staking.getAddress(), true);
    return { maleId, femaleId };
  }

  async function advanceTime(seconds: number) {
    await ethers.provider.send('evm_increaseTime', [seconds]);
    await ethers.provider.send('evm_mine', []);
  }

  beforeEach(async () => {
    await deployAll();
  });

  describe('initialize', () => {
    it('sets owner', async () => {
      expect(await staking.owner()).to.equal(owner.address);
    });

    it('sets SCALE and CYCLE constants', async () => {
      expect(await staking.SCALE()).to.equal(parseEther('1'));
      expect(await staking.CYCLE()).to.equal(BigInt(CYCLE));
    });

    it('sets default idealPairMultiplierBps to 20000', async () => {
      const [, , , , , multiplier] = await staking.getConfig();
      expect(multiplier).to.equal(20000n);
    });

    it('reverts ZeroAddress on zero owner', async () => {
      const c = await hre.network.create();
      const api = await upgrades(hre, c);
      const F = await c.ethers.getContractFactory('BitChickenStaking');
      await expect(
        api.deployProxy(F, [ZeroAddress, await nft.getAddress(), await token.getAddress()], {
          initializer: 'initialize',
        }),
      ).to.be.revertedWithCustomError(staking, 'ZeroAddress');
    });
  });

  describe('config setters', () => {
    it('setBaseRate only owner', async () => {
      await expect(staking.connect(staker).setBaseRate(1n)).to.be.revertedWithCustomError(
        staking,
        'OwnableUnauthorizedAccount',
      );
    });

    it('setWeights only owner', async () => {
      await expect(staking.connect(staker).setWeights(1n, 1n, 1n)).to.be.revertedWithCustomError(
        staking,
        'OwnableUnauthorizedAccount',
      );
    });

    it('setClaimBurnBps rejects bps > 10000 with InvalidBasisPoints', async () => {
      await expect(staking.connect(owner).setClaimBurnBps(10001n)).to.be.revertedWithCustomError(
        staking,
        'InvalidBasisPoints',
      );
    });

    it('setIdealPairMultiplierBps rejects bps < 10000 with MultiplierTooLow', async () => {
      await expect(staking.connect(owner).setIdealPairMultiplierBps(9999n)).to.be.revertedWithCustomError(
        staking,
        'MultiplierTooLow',
      );
    });

    it('setIdealPairMultiplierBps only owner', async () => {
      await expect(staking.connect(staker).setIdealPairMultiplierBps(20000n)).to.be.revertedWithCustomError(
        staking,
        'OwnableUnauthorizedAccount',
      );
    });

    it('getConfig returns all configured values including idealPairMultiplierBps', async () => {
      const [br, wH, wS, wM, bps, mult] = await staking.getConfig();
      expect(br).to.equal(BASE_RATE);
      expect(wH).to.equal(WEIGHT);
      expect(wS).to.equal(WEIGHT);
      expect(wM).to.equal(WEIGHT);
      expect(bps).to.equal(BURN_BPS);
      expect(mult).to.equal(20000n);
    });

    it('emits IdealPairMultiplierBpsSet on setIdealPairMultiplierBps', async () => {
      await expect(staking.connect(owner).setIdealPairMultiplierBps(15000n))
        .to.emit(staking, 'IdealPairMultiplierBpsSet')
        .withArgs(15000n);
    });
  });

  describe('stakePair', () => {
    it('stakes a Male+Female pair and emits PairStaked', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      const tx = await staking.connect(staker).stakePair(maleId, femaleId);
      await expect(tx).to.emit(staking, 'PairStaked');
    });

    it('PairStaked has matched=true for same-edition pair', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      const tx = await staking.connect(staker).stakePair(maleId, femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      expect(log).to.not.be.undefined;
      const decoded = staking.interface.decodeEventLog('PairStaked', log!.data, log!.topics);
      expect(decoded.matched).to.equal(true);
    });

    it('PairStaked has matched=false for different-edition pair', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 2n);
      const tx = await staking.connect(staker).stakePair(maleId, femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const decoded = staking.interface.decodeEventLog('PairStaked', log!.data, log!.topics);
      expect(decoded.matched).to.equal(false);
    });

    it('takes custody of both NFTs', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      await staking.connect(staker).stakePair(maleId, femaleId);
      expect(await nft.ownerOf(maleId)).to.equal(await staking.getAddress());
      expect(await nft.ownerOf(femaleId)).to.equal(await staking.getAddress());
    });

    it('marks NFTs as staked', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      await staking.connect(staker).stakePair(maleId, femaleId);
      expect(await staking.isStaked(maleId)).to.be.true;
      expect(await staking.isStaked(femaleId)).to.be.true;
    });

    it('reverts AlreadyStaked on double-stake', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      await staking.connect(staker).stakePair(maleId, femaleId);
      const { maleId: m2, femaleId: f2 } = await forgePairWithEditions(staker, 1n, 1n);
      await expect(staking.connect(staker).stakePair(maleId, f2)).to.be.revertedWithCustomError(
        staking,
        'AlreadyStaked',
      );
      await expect(staking.connect(staker).stakePair(m2, femaleId)).to.be.revertedWithCustomError(
        staking,
        'AlreadyStaked',
      );
    });

    it('reverts NotTokenOwner when caller does not own male', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      await expect(staking.connect(staker2).stakePair(maleId, femaleId)).to.be.revertedWithCustomError(
        staking,
        'NotTokenOwner',
      );
    });

    it('reverts GendersNotComplementary when male and female are swapped', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      await expect(staking.connect(staker).stakePair(femaleId, maleId)).to.be.revertedWithCustomError(
        staking,
        'GendersNotComplementary',
      );
    });

    it('reverts when paused', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      await staking.connect(owner).pause();
      await expect(staking.connect(staker).stakePair(maleId, femaleId)).to.revert(ethers);
    });
  });

  describe('claim — non-ideal pair (1x)', () => {
    it('reverts CycleNotElapsed before one cycle', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 2n);
      const tx = await staking.connect(staker).stakePair(maleId, femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const decoded = staking.interface.decodeEventLog('PairStaked', log!.data, log!.topics);
      const pairId = decoded.pairId;
      await expect(staking.connect(staker).claim(pairId)).to.be.revertedWithCustomError(staking, 'CycleNotElapsed');
    });

    it('yields correctly after one cycle', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 2n);
      const tx = await staking.connect(staker).stakePair(maleId, femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const pairId = staking.interface.decodeEventLog('PairStaked', log!.data, log!.topics).pairId;

      await advanceTime(CYCLE + 1);
      await staking.connect(staker).claim(pairId);
      expect(await token.balanceOf(staker.address)).to.be.gt(0n);
    });
  });

  describe('ideal-pair bonus (2x)', () => {
    it('same-edition pair earns 2x compared to different-edition pair with same stats', async () => {
      await nft.connect(owner).registerEdition('Clone Hen', 'ipfs://CLONE', 30, 40, 50, 1, 0, 0, 0, 0, 0, W_ALL);
      const cloneEditionId = await nft.editionCount();

      const { maleId: m1, femaleId: f1 } = await forgePairWithEditions(staker, 1n, 1n);
      const stakeTx1 = await staking.connect(staker).stakePair(m1, f1);
      const stakeRcpt1 = await stakeTx1.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const stakeLog1 = stakeRcpt1?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const idealPairId = staking.interface.decodeEventLog('PairStaked', stakeLog1!.data, stakeLog1!.topics).pairId;

      const { maleId: m2, femaleId: f2 } = await forgePairWithEditions(staker2, 1n, cloneEditionId);
      const stakeTx2 = await staking.connect(staker2).stakePair(m2, f2);
      const stakeRcpt2 = await stakeTx2.wait();
      const stakeLog2 = stakeRcpt2?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const normalPairId = staking.interface.decodeEventLog('PairStaked', stakeLog2!.data, stakeLog2!.topics).pairId;

      await advanceTime(CYCLE + 1);

      const pendingIdeal = await staking.pendingOf(idealPairId);
      const pendingNormal = await staking.pendingOf(normalPairId);

      expect(pendingIdeal).to.be.gt(0n);
      expect(pendingNormal).to.be.gt(0n);

      const ratio = (pendingIdeal * 10000n) / pendingNormal;
      expect(ratio).to.be.within(19900n, 20100n);
    });

    it('ideal pair pair.matched is stored as true', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      const tx = await staking.connect(staker).stakePair(maleId, femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const pairId = staking.interface.decodeEventLog('PairStaked', log!.data, log!.topics).pairId;
      const pair = await staking.getPair(pairId);
      expect(pair.matched).to.equal(true);
    });

    it('non-ideal pair.matched is stored as false', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 2n);
      const tx = await staking.connect(staker).stakePair(maleId, femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const pairId = staking.interface.decodeEventLog('PairStaked', log!.data, log!.topics).pairId;
      const pair = await staking.getPair(pairId);
      expect(pair.matched).to.equal(false);
    });

    it('owner can change multiplier and it affects pending yield', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      const tx = await staking.connect(staker).stakePair(maleId, femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const pairId = staking.interface.decodeEventLog('PairStaked', log!.data, log!.topics).pairId;

      await staking.connect(owner).setIdealPairMultiplierBps(10000n);
      await advanceTime(CYCLE + 1);
      const pending1x = await staking.pendingOf(pairId);

      await staking.connect(owner).setIdealPairMultiplierBps(20000n);
      const pending2x = await staking.pendingOf(pairId);

      expect(pending2x).to.equal(pending1x * 2n);
    });
  });

  describe('claimRange', () => {
    it('reverts RangeOutOfBounds when start >= pair count', async () => {
      await expect(staking.connect(staker).claimRange(0n, 1n)).to.be.revertedWithCustomError(
        staking,
        'RangeOutOfBounds',
      );
    });

    it('claims multiple pairs skipping those with 0 cycles', async () => {
      const { maleId: m1, femaleId: f1 } = await forgePairWithEditions(staker, 1n, 1n);
      const { maleId: m2, femaleId: f2 } = await forgePairWithEditions(staker, 1n, 2n);
      await staking.connect(staker).stakePair(m1, f1);
      await staking.connect(staker).stakePair(m2, f2);

      await advanceTime(CYCLE + 1);
      await expect(staking.connect(staker).claimRange(0n, 2n)).to.emit(staking, 'YieldClaimed');
      expect(await token.balanceOf(staker.address)).to.be.gt(0n);
    });
  });

  describe('unstakePair', () => {
    it('returns NFTs and removes pair', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      const tx = await staking.connect(staker).stakePair(maleId, femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const pairId = staking.interface.decodeEventLog('PairStaked', log!.data, log!.topics).pairId;

      await advanceTime(CYCLE + 1);
      await expect(staking.connect(staker).unstakePair(pairId)).to.emit(staking, 'PairUnstaked');
      expect(await nft.ownerOf(maleId)).to.equal(staker.address);
      expect(await nft.ownerOf(femaleId)).to.equal(staker.address);
      expect(await staking.isStaked(maleId)).to.be.false;
      expect(await staking.isStaked(femaleId)).to.be.false;
    });

    it('reverts NotPairOwner for wrong caller', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      const tx = await staking.connect(staker).stakePair(maleId, femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const pairId = staking.interface.decodeEventLog('PairStaked', log!.data, log!.topics).pairId;
      await expect(staking.connect(staker2).unstakePair(pairId)).to.be.revertedWithCustomError(staking, 'NotPairOwner');
    });
  });

  describe('views', () => {
    it('getPairsCount returns 0 initially', async () => {
      expect(await staking.getPairsCount(staker.address)).to.equal(0n);
    });

    it('getPairsCount increments on stake', async () => {
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      await staking.connect(staker).stakePair(maleId, femaleId);
      expect(await staking.getPairsCount(staker.address)).to.equal(1n);
    });

    it('getPairs returns empty array for out-of-bounds start', async () => {
      const ids = await staking.getPairs(staker.address, 0n, 10n);
      expect(ids.length).to.equal(0);
    });

    it('nextUnlock returns 0 for non-existent pair', async () => {
      expect(await staking.nextUnlock(9999n)).to.equal(0n);
    });

    it('pendingOf returns 0 for non-existent pair', async () => {
      expect(await staking.pendingOf(9999n)).to.equal(0n);
    });
  });

  describe('pause', () => {
    it('owner can pause and unpause', async () => {
      await staking.connect(owner).pause();
      const { maleId, femaleId } = await forgePairWithEditions(staker, 1n, 1n);
      await expect(staking.connect(staker).stakePair(maleId, femaleId)).to.revert(ethers);
      await staking.connect(owner).unpause();
      await expect(staking.connect(staker).stakePair(maleId, femaleId)).not.to.revert(ethers);
    });

    it('non-owner cannot pause', async () => {
      await expect(staking.connect(staker).pause()).to.be.revertedWithCustomError(
        staking,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Ownable2Step', () => {
    it('transferOwnership does not immediately change owner', async () => {
      await staking.connect(owner).transferOwnership(staker.address);
      expect(await staking.owner()).to.equal(owner.address);
    });

    it('transferOwnership sets pendingOwner', async () => {
      await staking.connect(owner).transferOwnership(staker.address);
      expect(await staking.pendingOwner()).to.equal(staker.address);
    });

    it('emits OwnershipTransferStarted', async () => {
      await expect(staking.connect(owner).transferOwnership(staker.address))
        .to.emit(staking, 'OwnershipTransferStarted')
        .withArgs(owner.address, staker.address);
    });

    it('acceptOwnership by pendingOwner finalises transfer', async () => {
      await staking.connect(owner).transferOwnership(staker.address);
      await staking.connect(staker).acceptOwnership();
      expect(await staking.owner()).to.equal(staker.address);
      expect(await staking.pendingOwner()).to.equal(ethers.ZeroAddress);
    });

    it('onlyOwner functions enforce current owner during pending', async () => {
      await staking.connect(owner).transferOwnership(staker.address);
      await expect(staking.connect(staker).setBaseRate(1n)).to.be.revertedWithCustomError(
        staking,
        'OwnableUnauthorizedAccount',
      );
      await expect(staking.connect(owner).setBaseRate(1n)).not.to.revert(ethers);
    });

    it('rejects acceptOwnership from non-pendingOwner', async () => {
      await staking.connect(owner).transferOwnership(staker.address);
      await expect(staking.connect(staker2).acceptOwnership()).to.be.revertedWithCustomError(
        staking,
        'OwnableUnauthorizedAccount',
      );
    });

    it('non-owner cannot call transferOwnership', async () => {
      await expect(staking.connect(staker).transferOwnership(staker2.address)).to.be.revertedWithCustomError(
        staking,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('A1–A5: exact yield math and event assertions', () => {
    async function stakePairAndGetId(
      signer: HardhatEthersSigner,
      maleEditionId: bigint,
      femaleEditionId: bigint,
    ): Promise<{ pairId: bigint; maleId: bigint; femaleId: bigint }> {
      const { maleId, femaleId } = await forgePairWithEditions(signer, maleEditionId, femaleEditionId);
      const tx = await staking.connect(signer).stakePair(maleId, femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const pairId = staking.interface.decodeEventLog('PairStaked', log!.data, log!.topics).pairId as bigint;
      return { pairId, maleId, femaleId };
    }

    it('A1: exact yield formula — 1 cycle, non-ideal pair, known edition stats', async () => {
      const { pairId } = await stakePairAndGetId(staker, 1n, 2n);

      await advanceTime(CYCLE + 1);

      const SCALE = parseEther('1');
      const h1 = 30n;
      const s1 = 40n;
      const m1 = 50n;
      const h2 = 60n;
      const s2 = 70n;
      const m2 = 80n;
      const score = WEIGHT * (h1 + h2) + WEIGHT * (s1 + s2) + WEIGHT * (m1 + m2);
      const base = (BASE_RATE * score) / SCALE;
      const rewardPerCycle = (base * 10000n) / 10000n;
      const gross = rewardPerCycle;
      const burned = (gross * BURN_BPS) / 10000n;
      const expectedNet = gross - burned;

      await staking.connect(staker).claim(pairId);

      expect(await token.balanceOf(staker.address)).to.equal(expectedNet);
    });

    it('A2: claim burn precision — 10% burn, event burned and net are exact', async () => {
      await staking.connect(owner).setClaimBurnBps(1000n);
      const { pairId } = await stakePairAndGetId(staker, 1n, 2n);

      await advanceTime(CYCLE + 1);

      const SCALE = parseEther('1');
      const score = WEIGHT * (30n + 60n) + WEIGHT * (40n + 70n) + WEIGHT * (50n + 80n);
      const base = (BASE_RATE * score) / SCALE;
      const gross = base;
      const expectedBurned = (gross * 1000n) / 10000n;
      const expectedNet = gross - expectedBurned;

      const tx = await staking.connect(staker).claim(pairId);
      const rcpt = await tx.wait();
      const topic = ethers.id('YieldClaimed(address,uint256,uint256,uint256,uint256,uint256)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const decoded = staking.interface.decodeEventLog('YieldClaimed', log!.data, log!.topics);

      expect(decoded.burned).to.equal(expectedBurned);
      expect(decoded.net).to.equal(expectedNet);
      expect(decoded.burned).to.equal((decoded.gross * 1000n) / 10000n);
      expect(decoded.net).to.equal(decoded.gross - decoded.burned);
    });

    it('A3: multi-cycle accrual — 2 cycles + partial remainder, no drift', async () => {
      const { pairId } = await stakePairAndGetId(staker, 1n, 2n);

      await advanceTime(2 * CYCLE + 100);

      const SCALE = parseEther('1');
      const score = WEIGHT * (30n + 60n) + WEIGHT * (40n + 70n) + WEIGHT * (50n + 80n);
      const base = (BASE_RATE * score) / SCALE;
      const rewardPerCycle = base;
      const expectedGross = 2n * rewardPerCycle;

      const tx = await staking.connect(staker).claim(pairId);
      const rcpt = await tx.wait();
      const topic = ethers.id('YieldClaimed(address,uint256,uint256,uint256,uint256,uint256)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const decoded = staking.interface.decodeEventLog('YieldClaimed', log!.data, log!.topics);

      expect(decoded.cycles).to.equal(2n);
      expect(decoded.gross).to.equal(expectedGross);

      const pairData = await staking.getPair(pairId);
      const lastClaimAt = BigInt(pairData.lastClaimAt);
      const latestBlock = await ethers.provider.getBlock('latest');
      const nowTs = BigInt(latestBlock!.timestamp);
      const elapsedSinceLastClaim = nowTs - lastClaimAt;
      expect(elapsedSinceLastClaim).to.be.lt(BigInt(CYCLE));
      expect(await staking.pendingOf(pairId)).to.equal(0n);

      await advanceTime(CYCLE + 1);
      expect(await staking.pendingOf(pairId)).to.equal(rewardPerCycle);
    });

    it('A4: YieldClaimed event full 6-param assertion', async () => {
      const { pairId } = await stakePairAndGetId(staker, 1n, 2n);

      await advanceTime(CYCLE + 1);

      const SCALE = parseEther('1');
      const score = WEIGHT * (30n + 60n) + WEIGHT * (40n + 70n) + WEIGHT * (50n + 80n);
      const base = (BASE_RATE * score) / SCALE;
      const gross = base;
      const burned = (gross * BURN_BPS) / 10000n;
      const net = gross - burned;

      const tx = await staking.connect(staker).claim(pairId);
      const rcpt = await tx.wait();
      const topic = ethers.id('YieldClaimed(address,uint256,uint256,uint256,uint256,uint256)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const decoded = staking.interface.decodeEventLog('YieldClaimed', log!.data, log!.topics);

      expect(decoded.staker).to.equal(staker.address);
      expect(decoded.pairId).to.equal(pairId);
      expect(decoded.gross).to.equal(gross);
      expect(decoded.burned).to.equal(burned);
      expect(decoded.net).to.equal(net);
      expect(decoded.cycles).to.equal(1n);
    });

    it('A5: pendingOf before claim equals event gross exactly', async () => {
      const { pairId } = await stakePairAndGetId(staker, 1n, 2n);

      await advanceTime(CYCLE + 1);

      const pendingBefore = await staking.pendingOf(pairId);
      expect(pendingBefore).to.be.gt(0n);

      const tx = await staking.connect(staker).claim(pairId);
      const rcpt = await tx.wait();
      const topic = ethers.id('YieldClaimed(address,uint256,uint256,uint256,uint256,uint256)');
      const log = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const decoded = staking.interface.decodeEventLog('YieldClaimed', log!.data, log!.topics);

      expect(decoded.gross).to.equal(pendingBefore);
    });
  });

  describe('config setters — typed events and bounds', () => {
    it('setBaseRate emits BaseRateSet', async () => {
      await expect(staking.connect(owner).setBaseRate(1n)).to.emit(staking, 'BaseRateSet').withArgs(1n);
    });

    it('setWeights emits WeightsSet', async () => {
      await expect(staking.connect(owner).setWeights(10n, 20n, 30n))
        .to.emit(staking, 'WeightsSet')
        .withArgs(10n, 20n, 30n);
    });

    it('setClaimBurnBps emits ClaimBurnBpsSet', async () => {
      await expect(staking.connect(owner).setClaimBurnBps(500n)).to.emit(staking, 'ClaimBurnBpsSet').withArgs(500n);
    });

    it('setBaseRate reverts BaseRateTooHigh above MAX_BASE_RATE', async () => {
      const maxBaseRate = 10n ** 27n;
      await expect(staking.connect(owner).setBaseRate(maxBaseRate + 1n)).to.be.revertedWithCustomError(
        staking,
        'BaseRateTooHigh',
      );
    });

    it('setWeights reverts WeightTooHigh above MAX_WEIGHT for health', async () => {
      const maxWeight = 10n ** 36n;
      await expect(staking.connect(owner).setWeights(maxWeight + 1n, 1n, 1n)).to.be.revertedWithCustomError(
        staking,
        'WeightTooHigh',
      );
    });

    it('setWeights reverts WeightTooHigh above MAX_WEIGHT for skill', async () => {
      const maxWeight = 10n ** 36n;
      await expect(staking.connect(owner).setWeights(1n, maxWeight + 1n, 1n)).to.be.revertedWithCustomError(
        staking,
        'WeightTooHigh',
      );
    });

    it('setWeights reverts WeightTooHigh above MAX_WEIGHT for morale', async () => {
      const maxWeight = 10n ** 36n;
      await expect(staking.connect(owner).setWeights(1n, 1n, maxWeight + 1n)).to.be.revertedWithCustomError(
        staking,
        'WeightTooHigh',
      );
    });
  });

  describe('onERC721Received — UnauthorizedNFT', () => {
    it('reverts UnauthorizedNFT when receiving a foreign ERC-721', async () => {
      const c = await hre.network.create();
      const cApi = await upgrades(hre, c);
      const [cOwner, cStaker] = await c.ethers.getSigners();

      const TokenF = await c.ethers.getContractFactory('BitChickenToken');
      const tokenProxy = await cApi.deployProxy(TokenF, ['B', 'B', cOwner.address, cOwner.address, cOwner.address], {
        initializer: 'initialize',
      });
      await tokenProxy.waitForDeployment();

      const NftF = await c.ethers.getContractFactory('BitChickenNFT');
      const foreignNftProxy = await cApi.deployProxy(NftF, [cOwner.address, await tokenProxy.getAddress()], {
        initializer: 'initialize',
      });
      await foreignNftProxy.waitForDeployment();
      const foreignNft = foreignNftProxy as unknown as BitChickenNFT;

      const StakingF = await c.ethers.getContractFactory('BitChickenStaking');
      const stakingProxy = await cApi.deployProxy(
        StakingF,
        [cOwner.address, await foreignNftProxy.getAddress(), await tokenProxy.getAddress()],
        { initializer: 'initialize' },
      );
      await stakingProxy.waitForDeployment();
      const localStaking = stakingProxy;

      const TokenF2 = await c.ethers.getContractFactory('BitChickenToken');
      const tokenProxy2 = await cApi.deployProxy(
        TokenF2,
        ['B2', 'B2', cOwner.address, cOwner.address, cOwner.address],
        { initializer: 'initialize' },
      );
      await tokenProxy2.waitForDeployment();

      const NftF2 = await c.ethers.getContractFactory('BitChickenNFT');
      const foreignNftProxy2 = await cApi.deployProxy(NftF2, [cOwner.address, await tokenProxy2.getAddress()], {
        initializer: 'initialize',
      });
      await foreignNftProxy2.waitForDeployment();
      const otherNft = foreignNftProxy2 as unknown as BitChickenNFT;

      await otherNft.connect(cOwner).registerEdition('Hen', 'ipfs://X', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      await otherNft.connect(cOwner).setForge(cOwner.address);
      const mintId = await otherNft.nextId();
      await otherNft.connect(cOwner).forgeMint(cStaker.address, 1n, 0, 'ForeignHen', 0n);

      await otherNft.connect(cStaker).setApprovalForAll(await localStaking.getAddress(), true);
      await expect(
        otherNft.connect(cStaker).safeTransferFrom(cStaker.address, await localStaking.getAddress(), mintId),
      ).to.be.revertedWithCustomError(localStaking, 'UnauthorizedNFT');
    });
  });
});

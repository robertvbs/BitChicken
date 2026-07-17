import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';
import { expect } from 'chai';
import { parseEther } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { BitChickenToken } from '../types/contracts/bitchicken-token.js';
import type { BitChickenNFT } from '../types/contracts/bitchicken-nft.js';
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
const KEY_HASH = '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc';

describe('BitChickenForge', () => {
  let token: BitChickenToken;
  let nft: BitChickenNFT;
  let forge: BitChickenForge;
  let vrfMock: VRFCoordinatorMock;
  let subId: bigint;
  let owner: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let ethers: Awaited<ReturnType<typeof hre.network.create>>['ethers'];

  async function deploy() {
    const connection = await hre.network.create();
    ethers = connection.ethers;
    const api = await upgrades(hre, connection);
    [owner, buyer, other] = await ethers.getSigners();

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

    const MINTER_ROLE = await token.MINTER_ROLE();
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

    await nft.connect(owner).registerEdition('Common Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
    await nft.connect(owner).registerEdition('Rare Rooster', 'ipfs://CID2', 60, 60, 60, 2, 0, 0, 0, 0, 0, W_ALL);
  }

  async function requestAndFulfill(
    tier: number,
    name: string,
    referrerCode = 0n,
  ): Promise<{ requestId: bigint; tokenId: bigint; editionId: bigint }> {
    const price = TIER_PRICES[tier];
    const reqTx = await forge.connect(buyer).requestObtain(tier, referrerCode, name, { value: price });
    const reqRcpt = await reqTx.wait();
    const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
    const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
    const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

    const tokensBefore = await nft.nextId();
    const fulfillTx = await vrfMock.fulfillRandomWords(requestId, await forge.getAddress());
    const fulfillRcpt = await fulfillTx.wait();

    const forgedTopic = ethers.id('ForgeFulfilled(address,uint256,uint256,uint256)');
    const forgedLog = fulfillRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === forgedTopic);
    const tokenId = forgedLog ? BigInt(forgedLog.topics[3]) - 1n : tokensBefore;
    const tokensAfter = await nft.nextId();
    const mintedTokenId = tokensAfter - 1n;

    const editionId = await nft.editionOf(mintedTokenId);
    return { requestId, tokenId: mintedTokenId, editionId };
  }

  beforeEach(async () => {
    await deploy();
  });

  describe('constructor', () => {
    it('stores nft, keyHash, subId', async () => {
      expect(await forge.nft()).to.equal(await nft.getAddress());
      expect(await forge.keyHash()).to.equal(KEY_HASH);
      expect(await forge.subId()).to.equal(subId);
    });

    it('reverts ZeroAddress for nft=0', async () => {
      const ForgeF = await ethers.getContractFactory('BitChickenForge');
      await expect(
        ForgeF.deploy(await vrfMock.getAddress(), ethers.ZeroAddress, KEY_HASH, subId, 500000, 3, owner.address),
      ).to.be.revertedWithCustomError(forge, 'ZeroAddress');
    });

    it('reverts ZeroAddress for owner=0', async () => {
      const ForgeF = await ethers.getContractFactory('BitChickenForge');
      await expect(
        ForgeF.deploy(
          await vrfMock.getAddress(),
          await nft.getAddress(),
          KEY_HASH,
          subId,
          500000,
          3,
          ethers.ZeroAddress,
        ),
      ).to.be.revertedWithCustomError(forge, 'ZeroAddress');
    });
  });

  describe('requestObtain', () => {
    it('emits ForgeRequested and stores the request', async () => {
      const price = TIER_PRICES[0];
      const tx = await forge.connect(buyer).requestObtain(0, 0n, 'TestHen', { value: price });
      await expect(tx).to.emit(forge, 'ForgeRequested').withArgs(buyer.address, 1n, 0n);
    });

    it('reverts IncorrectPayment on wrong value', async () => {
      await expect(
        forge.connect(buyer).requestObtain(0, 0n, 'TestHen', { value: parseEther('0.005') }),
      ).to.be.revertedWithCustomError(forge, 'IncorrectPayment');
    });

    it('reverts NothingAvailable when no editions for tier', async () => {
      const W_NO_TIER1: [number, number, number, number, number, number, number, number, number, number] = [
        100, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ];
      const connection = await hre.network.create();
      const api = await upgrades(hre, connection);
      const [o, b] = await connection.ethers.getSigners();
      const TF = await connection.ethers.getContractFactory('BitChickenToken');
      const tp = await api.deployProxy(TF, ['B', 'B', o.address, o.address, o.address], {
        initializer: 'initialize',
      });
      await tp.waitForDeployment();
      const NF = await connection.ethers.getContractFactory('BitChickenNFT');
      const np = await api.deployProxy(NF, [o.address, await tp.getAddress()], { initializer: 'initialize' });
      await np.waitForDeployment();
      await np.connect(o).updateTierPrices(TIER_PRICES);
      await np.connect(o).registerEdition('Hen', 'ipfs://X', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_NO_TIER1);

      const VRFMockF = await connection.ethers.getContractFactory('VRFCoordinatorMock');
      const vm = await VRFMockF.deploy(100000n, 1000000000n, 4000000000000000n);
      await vm.waitForDeployment();
      const cs = await vm.createSubscription();
      const cr = await cs.wait();
      const lg = cr?.logs.find(
        (l: { topics: string[] }) => l.topics[0] === connection.ethers.id('SubscriptionCreated(uint256,address)'),
      );
      const sid = lg ? BigInt(lg.topics[1]) : 1n;
      await vm.fundSubscription(sid, parseEther('10'));

      const FF = await connection.ethers.getContractFactory('BitChickenForge');
      const f = await FF.deploy(await vm.getAddress(), await np.getAddress(), KEY_HASH, sid, 500000, 3, o.address);
      await f.waitForDeployment();
      await vm.addConsumer(sid, await f.getAddress());
      await np.connect(o).setForge(await f.getAddress());

      await expect(f.connect(b).requestObtain(1, 0n, 'X', { value: TIER_PRICES[1] })).to.be.revertedWithCustomError(
        f,
        'NothingAvailable',
      );
    });
  });

  describe('fulfillRandomWords (via mock)', () => {
    it('mints an NFT to the buyer after VRF fulfills', async () => {
      const { tokenId } = await requestAndFulfill(0, 'VRFHen');
      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
    });

    it('minted NFT has a valid catalog edition (1 or 2)', async () => {
      const { editionId } = await requestAndFulfill(0, 'VRFHen');
      expect(editionId).to.be.within(1n, 2n);
    });

    it('minted NFT attributes match the edition stats', async () => {
      const { tokenId, editionId } = await requestAndFulfill(0, 'VRFHen');
      const [h, s, m] = await nft.attributesOf(tokenId);
      const edition = await nft.getEdition(editionId);
      expect(h).to.equal(edition.health);
      expect(s).to.equal(edition.skill);
      expect(m).to.equal(edition.morale);
    });

    it('emits ForgeFulfilled event', async () => {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(buyer).requestObtain(0, 0n, 'VRFHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

      await expect(vrfMock.fulfillRandomWords(requestId, await forge.getAddress())).to.emit(forge, 'ForgeFulfilled');
    });

    it('increments edition minted counter', async () => {
      const { editionId } = await requestAndFulfill(0, 'VRFHen');
      const edition = await nft.getEdition(editionId);
      expect(edition.minted).to.equal(1n);
    });

    it('cleans up the pending request after fulfillment', async () => {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(buyer).requestObtain(0, 0n, 'VRFHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

      await vrfMock.fulfillRandomWords(requestId, await forge.getAddress());

      const req = await forge.requests(requestId);
      expect(req.buyer).to.equal(ethers.ZeroAddress);
    });
  });

  describe('cancelStaleRequest', () => {
    it('reverts RequestNotStale before STALE_BLOCKS', async () => {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(buyer).requestObtain(0, 0n, 'TestHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

      await expect(forge.connect(buyer).cancelStaleRequest(requestId)).to.be.revertedWithCustomError(
        forge,
        'RequestNotStale',
      );
    });

    it('allows cancellation after STALE_BLOCKS and queues refund', async () => {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(buyer).requestObtain(0, 0n, 'TestHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

      const staleBlocks = await forge.STALE_BLOCKS();
      for (let i = 0; i < Number(staleBlocks); i++) {
        await ethers.provider.send('evm_mine', []);
      }

      await expect(forge.connect(buyer).cancelStaleRequest(requestId))
        .to.emit(forge, 'RequestCancelled')
        .withArgs(buyer.address, requestId, price);

      expect(await forge.pendingRefund(buyer.address)).to.equal(price);
    });

    it('reverts NotRequestOwner when non-buyer tries to cancel', async () => {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(buyer).requestObtain(0, 0n, 'TestHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

      const staleBlocks = await forge.STALE_BLOCKS();
      for (let i = 0; i < Number(staleBlocks); i++) {
        await ethers.provider.send('evm_mine', []);
      }

      await expect(forge.connect(other).cancelStaleRequest(requestId)).to.be.revertedWithCustomError(
        forge,
        'NotRequestOwner',
      );
    });

    it('reverts UnknownRequest for non-existent requestId', async () => {
      await expect(forge.connect(buyer).cancelStaleRequest(9999n)).to.be.revertedWithCustomError(
        forge,
        'UnknownRequest',
      );
    });
  });

  describe('claimRefund', () => {
    it('buyer can claim queued refund', async () => {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(buyer).requestObtain(0, 0n, 'TestHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

      const staleBlocks = await forge.STALE_BLOCKS();
      for (let i = 0; i < Number(staleBlocks); i++) {
        await ethers.provider.send('evm_mine', []);
      }
      await forge.connect(buyer).cancelStaleRequest(requestId);

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const claimTx = await forge.connect(buyer).claimRefund();
      const claimRcpt = await claimTx.wait();
      const gas = claimRcpt!.gasUsed * claimRcpt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);

      expect(balAfter + gas - balBefore).to.equal(price);
      expect(await forge.pendingRefund(buyer.address)).to.equal(0n);
    });

    it('reverts NothingToRefund when no pending refund', async () => {
      await expect(forge.connect(buyer).claimRefund()).to.be.revertedWithCustomError(forge, 'NothingToRefund');
    });
  });

  describe('referral BNB', () => {
    async function registerOwnerCode(): Promise<bigint> {
      await nft.connect(owner).registerReferrer();
      return nft.getReferrerCode(owner.address);
    }

    it('accrues 2% of the egg price to the referrer on the buyer first egg', async () => {
      const code = await registerOwnerCode();
      const price = TIER_PRICES[0];
      const expected = (price * 200n) / 10000n;
      await requestAndFulfill(0, 'RefHen', code);
      expect(await forge.pendingReferralBnb(owner.address)).to.equal(expected);
      expect(await forge.totalPendingReferralBnb()).to.equal(expected);
    });

    it('emits ReferralBnbAccrued with referrer, buyer and amount', async () => {
      const code = await registerOwnerCode();
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(buyer).requestObtain(0, code, 'RefHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;
      await expect(vrfMock.fulfillRandomWords(requestId, await forge.getAddress()))
        .to.emit(forge, 'ReferralBnbAccrued')
        .withArgs(owner.address, buyer.address, (price * 200n) / 10000n);
    });

    it('no accrual when no referrer code is provided', async () => {
      await requestAndFulfill(0, 'NoRef', 0n);
      expect(await forge.totalPendingReferralBnb()).to.equal(0n);
    });

    it('referrer claims the pending BNB and the pool is zeroed', async () => {
      const code = await registerOwnerCode();
      const price = TIER_PRICES[0];
      const expected = (price * 200n) / 10000n;
      await requestAndFulfill(0, 'RefHen', code);

      const balBefore = await ethers.provider.getBalance(owner.address);
      const claimTx = await forge.connect(owner).claimReferralBnb();
      const rcpt = await claimTx.wait();
      const gas = rcpt!.gasUsed * rcpt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(owner.address);

      expect(balAfter + gas - balBefore).to.equal(expected);
      expect(await forge.pendingReferralBnb(owner.address)).to.equal(0n);
      expect(await forge.totalPendingReferralBnb()).to.equal(0n);
    });

    it('reverts NothingToClaim when nothing pending', async () => {
      await expect(forge.connect(owner).claimReferralBnb()).to.be.revertedWithCustomError(forge, 'NothingToClaim');
    });

    it('withdraw reserves the referral pool and never drains referral rewards', async () => {
      const code = await registerOwnerCode();
      const price = TIER_PRICES[0];
      const expected = (price * 200n) / 10000n;
      await requestAndFulfill(0, 'RefHen', code);

      await forge.connect(owner).withdraw();
      expect(await ethers.provider.getBalance(await forge.getAddress())).to.equal(expected);

      await forge.connect(owner).claimReferralBnb();
      expect(await ethers.provider.getBalance(await forge.getAddress())).to.equal(0n);
    });
  });

  describe('setVRFConfig', () => {
    it('owner can update VRF config', async () => {
      const newKeyHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      await expect(forge.connect(owner).setVRFConfig(newKeyHash, 2n, 600000, 5))
        .to.emit(forge, 'VRFConfigSet')
        .withArgs(newKeyHash, 2n, 600000n, 5n);
      expect(await forge.keyHash()).to.equal(newKeyHash);
      expect(await forge.callbackGasLimit()).to.equal(600000n);
      expect(await forge.requestConfirmations()).to.equal(5n);
    });

    it('non-owner cannot update VRF config', async () => {
      await expect(forge.connect(buyer).setVRFConfig(KEY_HASH, subId, 500000, 3)).to.revert(ethers);
    });

    it('accepts callbackGasLimit at MIN_CALLBACK_GAS boundary (50_000)', async () => {
      await expect(forge.connect(owner).setVRFConfig(KEY_HASH, subId, 50000, 1)).not.to.revert(ethers);
      expect(await forge.callbackGasLimit()).to.equal(50000n);
    });

    it('accepts callbackGasLimit at MAX_CALLBACK_GAS boundary (2_500_000)', async () => {
      await expect(forge.connect(owner).setVRFConfig(KEY_HASH, subId, 2500000, 1)).not.to.revert(ethers);
      expect(await forge.callbackGasLimit()).to.equal(2500000n);
    });

    it('reverts CallbackGasLimitOutOfRange when below MIN (49_999)', async () => {
      await expect(forge.connect(owner).setVRFConfig(KEY_HASH, subId, 49999, 1))
        .to.be.revertedWithCustomError(forge, 'CallbackGasLimitOutOfRange')
        .withArgs(49999n);
    });

    it('reverts CallbackGasLimitOutOfRange when above MAX (2_500_001)', async () => {
      await expect(forge.connect(owner).setVRFConfig(KEY_HASH, subId, 2500001, 1))
        .to.be.revertedWithCustomError(forge, 'CallbackGasLimitOutOfRange')
        .withArgs(2500001n);
    });

    it('reverts CallbackGasLimitOutOfRange when zero', async () => {
      await expect(forge.connect(owner).setVRFConfig(KEY_HASH, subId, 0, 1))
        .to.be.revertedWithCustomError(forge, 'CallbackGasLimitOutOfRange')
        .withArgs(0n);
    });

    it('accepts requestConfirmations = 1', async () => {
      await expect(forge.connect(owner).setVRFConfig(KEY_HASH, subId, 500000, 1)).not.to.revert(ethers);
      expect(await forge.requestConfirmations()).to.equal(1n);
    });

    it('reverts RequestConfirmationsTooLow when requestConfirmations is 0', async () => {
      await expect(forge.connect(owner).setVRFConfig(KEY_HASH, subId, 500000, 0)).to.be.revertedWithCustomError(
        forge,
        'RequestConfirmationsTooLow',
      );
    });
  });

  describe('VRF bounds in constructor', () => {
    it('reverts CallbackGasLimitOutOfRange when constructed with callbackGasLimit below MIN', async () => {
      const ForgeF = await ethers.getContractFactory('BitChickenForge');
      await expect(
        ForgeF.deploy(await vrfMock.getAddress(), await nft.getAddress(), KEY_HASH, subId, 49999, 3, owner.address),
      )
        .to.be.revertedWithCustomError(forge, 'CallbackGasLimitOutOfRange')
        .withArgs(49999n);
    });

    it('reverts CallbackGasLimitOutOfRange when constructed with callbackGasLimit above MAX', async () => {
      const ForgeF = await ethers.getContractFactory('BitChickenForge');
      await expect(
        ForgeF.deploy(await vrfMock.getAddress(), await nft.getAddress(), KEY_HASH, subId, 2500001, 3, owner.address),
      )
        .to.be.revertedWithCustomError(forge, 'CallbackGasLimitOutOfRange')
        .withArgs(2500001n);
    });

    it('reverts RequestConfirmationsTooLow when constructed with requestConfirmations = 0', async () => {
      const ForgeF = await ethers.getContractFactory('BitChickenForge');
      await expect(
        ForgeF.deploy(await vrfMock.getAddress(), await nft.getAddress(), KEY_HASH, subId, 500000, 0, owner.address),
      ).to.be.revertedWithCustomError(forge, 'RequestConfirmationsTooLow');
    });

    it('deploys successfully with boundary-valid params (MIN gas, 1 confirmation)', async () => {
      const ForgeF = await ethers.getContractFactory('BitChickenForge');
      const f = await ForgeF.deploy(
        await vrfMock.getAddress(),
        await nft.getAddress(),
        KEY_HASH,
        subId,
        50000,
        1,
        owner.address,
      );
      await f.waitForDeployment();
      expect(await f.callbackGasLimit()).to.equal(50000n);
      expect(await f.requestConfirmations()).to.equal(1n);
    });
  });

  describe('withdraw', () => {
    it('owner can withdraw proceeds', async () => {
      await ethers.provider.send('hardhat_setBalance', [await forge.getAddress(), '0x' + parseEther('1').toString(16)]);
      const before = await ethers.provider.getBalance(owner.address);
      const tx = await forge.connect(owner).withdraw();
      const rcpt = await tx.wait();
      const gas = rcpt!.gasUsed * rcpt!.gasPrice;
      const after = await ethers.provider.getBalance(owner.address);
      expect(after + gas).to.be.gt(before);
    });

    it('non-owner cannot withdraw', async () => {
      await expect(forge.connect(buyer).withdraw()).to.revert(ethers);
    });

    it('withdraw excludes totalPendingRefunds from the drained amount', async () => {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(buyer).requestObtain(0, 0n, 'TestHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;
      const staleBlocks = await forge.STALE_BLOCKS();
      for (let i = 0; i < Number(staleBlocks); i++) {
        await ethers.provider.send('evm_mine', []);
      }
      await forge.connect(buyer).cancelStaleRequest(requestId);
      expect(await forge.totalPendingRefunds()).to.equal(price);

      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const withdrawTx = await forge.connect(owner).withdraw();
      const withdrawRcpt = await withdrawTx.wait();
      const gas = withdrawRcpt!.gasUsed * withdrawRcpt!.gasPrice;
      const ownerAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerAfter + gas - ownerBefore).to.equal(0n);

      expect(await forge.pendingRefund(buyer.address)).to.equal(price);
      await expect(forge.connect(buyer).claimRefund()).to.emit(forge, 'RefundClaimed').withArgs(buyer.address, price);
      expect(await forge.totalPendingRefunds()).to.equal(0n);
    });

    it('reserves the escrow at request time and routes it to pendingRefund when fulfillment fails', async () => {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(buyer).requestObtain(0, 0n, 'TestHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

      expect(await forge.totalPendingRefunds()).to.equal(price);

      await nft.connect(owner).setEditionActive(1n, false);
      await nft.connect(owner).setEditionActive(2n, false);

      await expect(vrfMock.fulfillRandomWords(requestId, await forge.getAddress()))
        .to.emit(forge, 'RequestCancelled')
        .withArgs(buyer.address, requestId, price);

      expect(await forge.pendingRefund(buyer.address)).to.equal(price);
      expect(await forge.totalPendingRefunds()).to.equal(price);

      await forge.connect(owner).withdraw();
      expect(await ethers.provider.getBalance(await forge.getAddress())).to.equal(price);

      await expect(forge.connect(buyer).claimRefund()).to.emit(forge, 'RefundClaimed').withArgs(buyer.address, price);
      expect(await forge.totalPendingRefunds()).to.equal(0n);
    });

    it('releases the reservation on a successful fulfillment so proceeds become withdrawable', async () => {
      const price = TIER_PRICES[0];
      const reqTx = await forge.connect(buyer).requestObtain(0, 0n, 'TestHen', { value: price });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;

      expect(await forge.totalPendingRefunds()).to.equal(price);

      await expect(vrfMock.fulfillRandomWords(requestId, await forge.getAddress())).to.emit(forge, 'ForgeFulfilled');

      expect(await forge.totalPendingRefunds()).to.equal(0n);

      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const withdrawTx = await forge.connect(owner).withdraw();
      const withdrawRcpt = await withdrawTx.wait();
      const gas = withdrawRcpt!.gasUsed * withdrawRcpt!.gasPrice;
      const ownerAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerAfter + gas - ownerBefore).to.equal(price);
      expect(await ethers.provider.getBalance(await forge.getAddress())).to.equal(0n);
    });
  });

  describe('multiple consecutive forges', () => {
    it('two sequential forges both produce valid NFTs', async () => {
      const { tokenId: t1, editionId: e1 } = await requestAndFulfill(0, 'Hen1');
      const { tokenId: t2, editionId: e2 } = await requestAndFulfill(0, 'Hen2');
      expect(t1).to.not.equal(t2);
      expect(e1).to.be.within(1n, 2n);
      expect(e2).to.be.within(1n, 2n);
      expect(await nft.ownerOf(t1)).to.equal(buyer.address);
      expect(await nft.ownerOf(t2)).to.equal(buyer.address);
    });
  });
});

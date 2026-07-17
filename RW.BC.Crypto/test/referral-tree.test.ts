import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';
import { expect } from 'chai';
import { parseEther, ZeroAddress } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { BitChickenToken } from '../types/ethers-contracts/bitchicken-token.sol/BitChickenToken.js';
import type { BitChickenNFT } from '../types/ethers-contracts/bitchicken-nft.sol/BitChickenNFT.js';

const W_ALL: [number, number, number, number, number, number, number, number, number, number] = [
  100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
];
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

const DEFAULT_THRESHOLDS = [0n, 3n, 6n, 8n, 10n];
const DEFAULT_RATES = [200, 400, 600, 800, 1000];

describe('ReferralTreeManagement (via BitChickenNFT)', () => {
  let token: BitChickenToken;
  let nft: BitChickenNFT;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let referees: HardhatEthersSigner[];

  async function deployAll() {
    const connection = await hre.network.create();
    const { ethers } = connection;
    const api = await upgrades(hre, connection);
    const signers = await ethers.getSigners();
    [owner, alice, bob, carol] = signers;
    referees = signers.slice(4);

    const TokenF = await ethers.getContractFactory('BitChickenToken');
    const tokenProxy = await api.deployProxy(
      TokenF,
      ['BitChicken', 'BCK', owner.address, owner.address, owner.address],
      { initializer: 'initialize' },
    );
    await tokenProxy.waitForDeployment();
    token = tokenProxy as unknown as BitChickenToken;

    const NftF = await ethers.getContractFactory('BitChickenNFT');
    const nftProxy = await api.deployProxy(NftF, [owner.address, await token.getAddress()], {
      initializer: 'initialize',
    });
    await nftProxy.waitForDeployment();
    nft = nftProxy as unknown as BitChickenNFT;

    await nft.connect(owner).updateTierPrices(TIER_PRICES);
    await nft.connect(owner).registerEdition('Common Hen', 'ipfs://CID1', 30, 40, 50, 1, 0, 0, 0, 0, 0, W_ALL);
    // The Forge is impersonated by `owner` so forgeMint can be called directly in tests.
    await nft.connect(owner).setForge(owner.address);
    // Default level table is seeded by the initializer ([0,3,6,8,10] → [2%,4%,6%,8%,10%]).
  }

  async function link(buyer: HardhatEthersSigner, code: bigint): Promise<void> {
    await nft.connect(owner).forgeMint(buyer.address, 1n, 0, 'Hen', code);
  }

  beforeEach(async () => {
    await deployAll();
  });

  describe('registerReferrer', () => {
    it('assigns codes sequentially starting at 1000', async () => {
      await nft.connect(alice).registerReferrer();
      await nft.connect(bob).registerReferrer();
      expect(await nft.getReferrerCode(alice.address)).to.equal(1000n);
      expect(await nft.getReferrerCode(bob.address)).to.equal(1001n);
    });

    it('emits ReferrerRegistered', async () => {
      await expect(nft.connect(alice).registerReferrer())
        .to.emit(nft, 'ReferrerRegistered')
        .withArgs(alice.address, 1000n);
    });

    it('reverts AlreadyRegistered on second call', async () => {
      await nft.connect(alice).registerReferrer();
      await expect(nft.connect(alice).registerReferrer()).to.be.revertedWithCustomError(nft, 'AlreadyRegistered');
    });

    it('unregistered address has code 0', async () => {
      expect(await nft.getReferrerCode(alice.address)).to.equal(0n);
    });
  });

  describe('upline & first-egg link', () => {
    it('sets upline on first egg with valid code and emits ReferralLinked', async () => {
      await nft.connect(alice).registerReferrer();
      const code = await nft.getReferrerCode(alice.address);
      await expect(nft.connect(owner).forgeMint(bob.address, 1n, 0, 'Hen', code))
        .to.emit(nft, 'ReferralLinked')
        .withArgs(bob.address, alice.address);
      expect(await nft.getUpline(bob.address)).to.equal(alice.address);
    });

    it('forgeMint returns (referrer, rateBps) on the first egg', async () => {
      await nft.connect(alice).registerReferrer();
      const code = await nft.getReferrerCode(alice.address);
      const res = await nft.connect(owner).forgeMint.staticCall(bob.address, 1n, 0, 'Hen', code);
      expect(res[1]).to.equal(alice.address);
      expect(res[2]).to.equal(200n);
    });

    it('code 0 → no upline, returns (0, 0)', async () => {
      const res = await nft.connect(owner).forgeMint.staticCall(bob.address, 1n, 0, 'Hen', 0n);
      expect(res[1]).to.equal(ZeroAddress);
      expect(res[2]).to.equal(0n);
      await link(bob, 0n);
      expect(await nft.getUpline(bob.address)).to.equal(ZeroAddress);
    });

    it('unknown code → no upline, returns (0, 0), no revert', async () => {
      const res = await nft.connect(owner).forgeMint.staticCall(bob.address, 1n, 0, 'Hen', 9999n);
      expect(res[1]).to.equal(ZeroAddress);
      expect(res[2]).to.equal(0n);
      await link(bob, 9999n);
      expect(await nft.getUpline(bob.address)).to.equal(ZeroAddress);
    });

    it('self-referral → no upline, returns (0, 0)', async () => {
      await nft.connect(alice).registerReferrer();
      const code = await nft.getReferrerCode(alice.address);
      const res = await nft.connect(owner).forgeMint.staticCall(alice.address, 1n, 0, 'Hen', code);
      expect(res[1]).to.equal(ZeroAddress);
      expect(res[2]).to.equal(0n);
      await link(alice, code);
      expect(await nft.getUpline(alice.address)).to.equal(ZeroAddress);
      expect(await nft.getReferredCount(alice.address)).to.equal(0n);
    });

    it('second egg of an already-linked buyer pays nothing and does not re-count', async () => {
      await nft.connect(alice).registerReferrer();
      await nft.connect(carol).registerReferrer();
      const codeAlice = await nft.getReferrerCode(alice.address);
      const codeCarol = await nft.getReferrerCode(carol.address);
      await link(bob, codeAlice);
      expect(await nft.getReferredCount(alice.address)).to.equal(1n);

      const res = await nft.connect(owner).forgeMint.staticCall(bob.address, 1n, 0, 'Hen', codeCarol);
      expect(res[1]).to.equal(ZeroAddress);
      expect(res[2]).to.equal(0n);
      await link(bob, codeCarol);
      expect(await nft.getUpline(bob.address)).to.equal(alice.address);
      expect(await nft.getReferredCount(carol.address)).to.equal(0n);
    });
  });

  describe('referred count & rate by level', () => {
    it('increments referredCount once per distinct referee', async () => {
      await nft.connect(alice).registerReferrer();
      const code = await nft.getReferrerCode(alice.address);
      await link(bob, code);
      await link(carol, code);
      expect(await nft.getReferredCount(alice.address)).to.equal(2n);
    });

    it('getReferralRateBps rises at thresholds 3/6/8/10', async () => {
      await nft.connect(alice).registerReferrer();
      const code = await nft.getReferrerCode(alice.address);
      const checkpoints: [number, bigint][] = [
        [0, 200n],
        [3, 400n],
        [6, 600n],
        [8, 800n],
        [10, 1000n],
      ];
      let linked = 0;
      for (const [count, rate] of checkpoints) {
        while (linked < count) {
          await link(referees[linked], code);
          linked++;
        }
        expect(await nft.getReferredCount(alice.address)).to.equal(BigInt(count));
        expect(await nft.getReferralRateBps(alice.address)).to.equal(rate);
      }
    });

    it('rate is evaluated BEFORE counting the new referee', async () => {
      await nft.connect(alice).registerReferrer();
      const code = await nft.getReferrerCode(alice.address);
      // Bring Alice to exactly 2 referees (still level 00 = 2%).
      await link(referees[0], code);
      await link(referees[1], code);
      expect(await nft.getReferredCount(alice.address)).to.equal(2n);

      // The 3rd referee pays at the level BEFORE being counted: 2%, not 4%.
      const res = await nft.connect(owner).forgeMint.staticCall(referees[2].address, 1n, 0, 'Hen', code);
      expect(res[2]).to.equal(200n);

      await link(referees[2], code);
      // Now Alice is level 01 → the next referee would pay 4%.
      expect(await nft.getReferredCount(alice.address)).to.equal(3n);
      expect(await nft.getReferralRateBps(alice.address)).to.equal(400n);
    });
  });

  describe('setReferralLevels (admin)', () => {
    it('default table is seeded by the initializer', async () => {
      const [thresholds, rates] = await nft.getReferralLevels();
      expect(thresholds).to.deep.equal(DEFAULT_THRESHOLDS);
      expect(rates).to.deep.equal(DEFAULT_RATES);
    });

    it('MAX_REFERRAL_BPS is 1000 (10%)', async () => {
      expect(await nft.MAX_REFERRAL_BPS()).to.equal(1000);
    });

    it('updates the table and affects future rate', async () => {
      await nft.connect(owner).setReferralLevels([0n, 5n], [100, 1000]);
      const [thresholds, rates] = await nft.getReferralLevels();
      expect(thresholds).to.deep.equal([0n, 5n]);
      expect(rates).to.deep.equal([100, 1000]);
      await nft.connect(alice).registerReferrer();
      expect(await nft.getReferralRateBps(alice.address)).to.equal(100n);
    });

    it('only owner', async () => {
      await expect(nft.connect(alice).setReferralLevels([0n], [100])).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );
    });

    it('reverts InvalidLevels on empty table', async () => {
      await expect(nft.connect(owner).setReferralLevels([], [])).to.be.revertedWithCustomError(nft, 'InvalidLevels');
    });

    it('reverts InvalidLevels on length mismatch', async () => {
      await expect(nft.connect(owner).setReferralLevels([0n, 3n], [200])).to.be.revertedWithCustomError(
        nft,
        'InvalidLevels',
      );
    });

    it('reverts InvalidLevels when first threshold != 0', async () => {
      await expect(nft.connect(owner).setReferralLevels([1n], [200])).to.be.revertedWithCustomError(
        nft,
        'InvalidLevels',
      );
    });

    it('reverts InvalidLevels on non-ascending thresholds', async () => {
      await expect(nft.connect(owner).setReferralLevels([0n, 3n, 3n], [200, 400, 600])).to.be.revertedWithCustomError(
        nft,
        'InvalidLevels',
      );
    });

    it('reverts InvalidLevels when a rate exceeds MAX_REFERRAL_BPS', async () => {
      await expect(nft.connect(owner).setReferralLevels([0n], [1001])).to.be.revertedWithCustomError(
        nft,
        'InvalidLevels',
      );
    });

    it('accepts a rate exactly at MAX_REFERRAL_BPS', async () => {
      await nft.connect(owner).setReferralLevels([0n], [1000]);
      const [, rates] = await nft.getReferralLevels();
      expect(rates).to.deep.equal([1000]);
    });
  });
});

import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';
import { expect } from 'chai';
import { parseEther } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { BitChickenToken } from '../types/contracts/bitchicken-token.js';
import type { BitChickenNFT } from '../types/contracts/bitchicken-nft.js';

const W_ALL: [number, number, number, number, number, number, number, number, number, number] = [
  100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
];
const W_TIER0_ONLY: [number, number, number, number, number, number, number, number, number, number] = [
  100, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

describe('CatalogManagement (via BitChickenNFT)', () => {
  let token: BitChickenToken;
  let nft: BitChickenNFT;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let ethers: Awaited<ReturnType<typeof hre.network.create>>['ethers'];

  async function deploy() {
    const connection = await hre.network.create();
    ethers = connection.ethers;
    const api = await upgrades(hre, connection);
    [owner, user] = await ethers.getSigners();

    const TokenF = await ethers.getContractFactory('BitChickenToken');
    const tokenProxy = await api.deployProxy(
      TokenF,
      ['BitChicken', 'BCK', owner.address, owner.address, owner.address],
      { initializer: 'initialize' },
    );
    await tokenProxy.waitForDeployment();
    token = tokenProxy as unknown as BitChickenToken;
    await token.connect(owner).setEmissionCap(parseEther('1000000000'));
    const MINTER_ROLE = await token.MINTER_ROLE();
    await token.connect(owner).grantRole(MINTER_ROLE, await token.getAddress());

    const NftF = await ethers.getContractFactory('BitChickenNFT');
    const nftProxy = await api.deployProxy(NftF, [owner.address, await token.getAddress()], {
      initializer: 'initialize',
    });
    await nftProxy.waitForDeployment();
    nft = nftProxy as unknown as BitChickenNFT;
    await token.connect(owner).grantRole(MINTER_ROLE, await nft.getAddress());
  }

  beforeEach(async () => {
    await deploy();
  });

  describe('registerEdition', () => {
    it('owner registers an edition and editionCount increments', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      expect(await nft.editionCount()).to.equal(1n);
    });

    it('returns editionId starting at 1', async () => {
      const tx = await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      await expect(tx).to.emit(nft, 'EditionRegistered').withArgs(1n, 'Hen', 0n, 1n);
    });

    it('second edition gets id 2', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      const tx = await nft
        .connect(owner)
        .registerEdition('Rooster', 'ipfs://CID2', 60, 60, 60, 2, 0, 0, 0, 0, 0, W_ALL);
      await expect(tx).to.emit(nft, 'EditionRegistered').withArgs(2n, 'Rooster', 0n, 2n);
    });

    it('non-owner cannot register', async () => {
      await expect(
        nft.connect(user).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL),
      ).to.be.revertedWithCustomError(nft, 'OwnableUnauthorizedAccount');
    });

    it('reverts InvalidEditionStats when health=0', async () => {
      await expect(
        nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 0, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL),
      ).to.be.revertedWithCustomError(nft, 'InvalidEditionStats');
    });

    it('reverts InvalidEditionStats when skill=0', async () => {
      await expect(
        nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 0, 30, 1, 0, 0, 0, 0, 0, W_ALL),
      ).to.be.revertedWithCustomError(nft, 'InvalidEditionStats');
    });

    it('reverts InvalidEditionStats when morale=0', async () => {
      await expect(
        nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 0, 1, 0, 0, 0, 0, 0, W_ALL),
      ).to.be.revertedWithCustomError(nft, 'InvalidEditionStats');
    });
  });

  describe('getEdition', () => {
    it('returns correct fields for a registered edition', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 40, 50, 1, 100, 0, 0, 0, 0, W_ALL);
      const e = await nft.getEdition(1n);
      expect(e.name).to.equal('Hen');
      expect(e.artURI).to.equal('ipfs://CID1');
      expect(e.health).to.equal(30n);
      expect(e.skill).to.equal(40n);
      expect(e.morale).to.equal(50n);
      expect(e.rarity).to.equal(1n);
      expect(e.maxSupply).to.equal(100n);
      expect(e.minted).to.equal(0n);
      expect(e.active).to.equal(true);
    });

    it('reverts UnknownEdition for non-existent id', async () => {
      await expect(nft.getEdition(99n)).to.be.revertedWithCustomError(nft, 'UnknownEdition');
    });
  });

  describe('getEditionTierWeights', () => {
    it('returns configured weights', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_TIER0_ONLY);
      const weights = await nft.getEditionTierWeights(1n);
      expect(weights[0]).to.equal(100n);
      for (let i = 1; i < 10; i++) expect(weights[i]).to.equal(0n);
    });
  });

  describe('setEditionActive', () => {
    it('owner can deactivate and reactivate an edition', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      await expect(nft.connect(owner).setEditionActive(1n, false)).to.emit(nft, 'EditionActiveSet').withArgs(1n, false);
      const e = await nft.getEdition(1n);
      expect(e.active).to.equal(false);

      await nft.connect(owner).setEditionActive(1n, true);
      const e2 = await nft.getEdition(1n);
      expect(e2.active).to.equal(true);
    });

    it('non-owner cannot setEditionActive', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      await expect(nft.connect(user).setEditionActive(1n, false)).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );
    });

    it('reverts UnknownEdition for non-existent id', async () => {
      await expect(nft.connect(owner).setEditionActive(99n, false)).to.be.revertedWithCustomError(
        nft,
        'UnknownEdition',
      );
    });
  });

  describe('setEditionWindow', () => {
    it('owner can set time window', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      const start = BigInt(Math.floor(Date.now() / 1000) - 1000);
      const end = BigInt(Math.floor(Date.now() / 1000) + 1000000);
      await expect(nft.connect(owner).setEditionWindow(1n, start, end))
        .to.emit(nft, 'EditionWindowSet')
        .withArgs(1n, start, end);
    });

    it('reverts UnknownEdition for non-existent id', async () => {
      await expect(nft.connect(owner).setEditionWindow(99n, 0n, 0n)).to.be.revertedWithCustomError(
        nft,
        'UnknownEdition',
      );
    });
  });

  describe('tierHasAvailable', () => {
    it('returns false when no editions registered', async () => {
      expect(await nft.tierHasAvailable(0)).to.equal(false);
    });

    it('returns true after registering a gacha edition for that tier', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      expect(await nft.tierHasAvailable(0)).to.equal(true);
    });

    it('returns false when the only edition is inactive', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      await nft.connect(owner).setEditionActive(1n, false);
      expect(await nft.tierHasAvailable(0)).to.equal(false);
    });

    it('returns false for a tier with no weight', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_TIER0_ONLY);
      expect(await nft.tierHasAvailable(0)).to.equal(true);
      expect(await nft.tierHasAvailable(1)).to.equal(false);
    });

    it('returns false when DirectSale edition and no gacha editions', async () => {
      await nft
        .connect(owner)
        .registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, parseEther('0.05'), 1, W_ALL);
      expect(await nft.tierHasAvailable(0)).to.equal(false);
    });

    it('returns false when edition is sold out', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 1, 0, 0, 0, 0, W_ALL);

      const tierPrices: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
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
      await nft.connect(owner).updateTierPrices(tierPrices);

      const ForgeF = await ethers.getContractFactory('BitChickenForge');
      const VRFMock = await ethers.getContractFactory('VRFCoordinatorMock');
      const vrfMock = await VRFMock.deploy(100000n, 1000000000n, 4000000000000000n);
      await vrfMock.waitForDeployment();

      const createSub = await vrfMock.createSubscription();
      const rcpt = await createSub.wait();
      const log = rcpt?.logs.find(
        (l: { topics: string[] }) => l.topics[0] === ethers.id('SubscriptionCreated(uint256,address)'),
      );
      const subId = log ? BigInt(log.topics[1]) : 1n;
      await vrfMock.fundSubscription(subId, parseEther('10'));

      const forge = await ForgeF.deploy(
        await vrfMock.getAddress(),
        await nft.getAddress(),
        '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
        subId,
        500000,
        3,
        owner.address,
      );
      await forge.waitForDeployment();
      await vrfMock.addConsumer(subId, await forge.getAddress());
      await nft.connect(owner).setForge(await forge.getAddress());

      const reqTx = await forge.connect(user).requestObtain(0, 0, 'TestHen', { value: parseEther('0.01') });
      const reqRcpt = await reqTx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = reqRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 1n;
      await vrfMock.fulfillRandomWords(requestId, await forge.getAddress());

      expect(await nft.tierHasAvailable(0)).to.equal(false);
    });
  });

  describe('registerEdition name validation', () => {
    it('reverts InvalidEditionName on empty name', async () => {
      await expect(
        nft.connect(owner).registerEdition('', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL),
      ).to.be.revertedWithCustomError(nft, 'InvalidEditionName');
    });

    it('reverts InvalidEditionName when name exceeds 64 bytes', async () => {
      const longName = 'A'.repeat(65);
      await expect(
        nft.connect(owner).registerEdition(longName, 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL),
      ).to.be.revertedWithCustomError(nft, 'InvalidEditionName');
    });

    it('accepts name at exactly 64 bytes', async () => {
      const maxName = 'A'.repeat(64);
      await expect(
        nft.connect(owner).registerEdition(maxName, 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL),
      ).not.to.revert(ethers);
    });
  });

  describe('edition window validation', () => {
    it('reverts InvalidEditionWindow when mintEnd <= mintStart (both non-zero)', async () => {
      const start = 1000000n;
      const end = 999999n;
      await expect(
        nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, start, end, 0, 0, W_ALL),
      ).to.be.revertedWithCustomError(nft, 'InvalidEditionWindow');
    });

    it('reverts InvalidEditionWindow when mintEnd == mintStart (both non-zero)', async () => {
      const ts = 1000000n;
      await expect(
        nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, ts, ts, 0, 0, W_ALL),
      ).to.be.revertedWithCustomError(nft, 'InvalidEditionWindow');
    });

    it('allows mintEnd=0 with non-zero mintStart (open-ended window)', async () => {
      await expect(
        nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 1000000n, 0n, 0, 0, W_ALL),
      ).not.to.revert(ethers);
    });

    it('reverts InvalidEditionWindow on setEditionWindow when mintEnd <= mintStart', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      await expect(nft.connect(owner).setEditionWindow(1n, 2000000n, 1000000n)).to.be.revertedWithCustomError(
        nft,
        'InvalidEditionWindow',
      );
    });
  });

  describe('pickEdition', () => {
    it('reverts NoAvailableEdition when no editions', async () => {
      await expect(nft.pickEdition(0, 12345n)).to.be.revertedWithCustomError(nft, 'NoAvailableEdition');
    });

    it('always returns a valid active edition', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      await nft.connect(owner).registerEdition('Rooster', 'ipfs://CID2', 60, 60, 60, 2, 0, 0, 0, 0, 0, W_ALL);
      for (let word = 0; word < 20; word++) {
        const eid = await nft.pickEdition(0, BigInt(word) * 997n + 1n);
        expect(eid).to.be.within(1n, 2n);
      }
    });

    it('skips inactive edition and returns the other', async () => {
      await nft.connect(owner).registerEdition('Hen', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, W_ALL);
      await nft.connect(owner).registerEdition('Rooster', 'ipfs://CID2', 60, 60, 60, 2, 0, 0, 0, 0, 0, W_ALL);
      await nft.connect(owner).setEditionActive(1n, false);
      for (let word = 0; word < 10; word++) {
        const eid = await nft.pickEdition(0, BigInt(word) * 997n + 1n);
        expect(eid).to.equal(2n);
      }
    });

    it('weighted selection favours high-weight edition', async () => {
      const wHigh: [number, number, number, number, number, number, number, number, number, number] = [
        1000, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ];
      const wLow: [number, number, number, number, number, number, number, number, number, number] = [
        1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ];
      await nft.connect(owner).registerEdition('Common', 'ipfs://CID1', 30, 30, 30, 1, 0, 0, 0, 0, 0, wHigh);
      await nft.connect(owner).registerEdition('Rare', 'ipfs://CID2', 60, 60, 60, 2, 0, 0, 0, 0, 0, wLow);
      let commonCount = 0;
      for (let word = 0; word < 100; word++) {
        const eid = await nft.pickEdition(0, BigInt(word * 1337 + 99));
        if (eid === 1n) commonCount++;
      }
      expect(commonCount).to.be.gt(85);
    });
  });
});

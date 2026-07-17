import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';
import { expect } from 'chai';
import { parseEther, ZeroAddress } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { BitChickenToken } from '../types/contracts/bitchicken-token.js';
import type { BitChickenNFT } from '../types/contracts/bitchicken-nft.js';
import type { BitChickenForge } from '../types/contracts/bitchicken-forge.js';

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

describe('BitChickenNFT', () => {
  let token: BitChickenToken;
  let nft: BitChickenNFT;
  let forge: BitChickenForge;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let ethers: Awaited<ReturnType<typeof hre.network.create>>['ethers'];

  async function deploy() {
    const connection = await hre.network.create();
    ethers = connection.ethers;
    const api = await upgrades(hre, connection);
    [owner, user, user2, other] = await ethers.getSigners();

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
    await nft.connect(owner).setRenamePrice(parseEther('10'));

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

    const ForgeF = await ethers.getContractFactory('BitChickenForge');
    forge = (await ForgeF.deploy(
      await vrfMock.getAddress(),
      await nft.getAddress(),
      '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
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
    await nft
      .connect(owner)
      .registerEdition('Golden Chick', 'ipfs://CID3', 70, 65, 60, 2, 500, 0, 0, parseEther('0.05'), 1, W_DIRECT);
  }

  beforeEach(async () => {
    await deploy();
  });

  describe('initialize', () => {
    it('sets ERC-721 name and symbol', async () => {
      expect(await nft.name()).to.equal('BitChicken');
      expect(await nft.symbol()).to.equal('BCK');
    });

    it('sets owner', async () => {
      expect(await nft.owner()).to.equal(owner.address);
    });

    it('reverts ZeroAddress for owner=0', async () => {
      const connection = await hre.network.create();
      const api = await upgrades(hre, connection);
      const [o] = await connection.ethers.getSigners();
      const TF = await connection.ethers.getContractFactory('BitChickenToken');
      const tp = await api.deployProxy(TF, ['B', 'B', o.address, o.address, o.address], {
        initializer: 'initialize',
      });
      await tp.waitForDeployment();
      const NF = await connection.ethers.getContractFactory('BitChickenNFT');
      await expect(api.deployProxy(NF, [ZeroAddress, await tp.getAddress()], { initializer: 'initialize' })).to.revert(
        ethers,
      );
    });
  });

  describe('setForge', () => {
    it('owner can set forge', async () => {
      await expect(nft.connect(owner).setForge(user.address)).to.emit(nft, 'ForgeSet').withArgs(user.address);
    });

    it('non-owner cannot set forge', async () => {
      await expect(nft.connect(user).setForge(user.address)).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );
    });

    it('reverts ZeroAddress', async () => {
      await expect(nft.connect(owner).setForge(ZeroAddress)).to.be.revertedWithCustomError(nft, 'ZeroAddress');
    });
  });

  describe('setRenamePrice', () => {
    it('owner can set rename price', async () => {
      await expect(nft.connect(owner).setRenamePrice(parseEther('5')))
        .to.emit(nft, 'RenamePriceSet')
        .withArgs(parseEther('5'));
      expect(await nft.renamePrice()).to.equal(parseEther('5'));
    });

    it('non-owner cannot set rename price', async () => {
      await expect(nft.connect(user).setRenamePrice(1n)).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('forgeMint', () => {
    it('only forge can call forgeMint', async () => {
      await expect(nft.connect(user).forgeMint(user.address, 1n, 0, 'TestHen', 0n)).to.be.revertedWithCustomError(
        nft,
        'CallerNotForge',
      );
    });

    it('forge mints token with correct edition and gender', async () => {
      await nft.connect(owner).setForge(owner.address);
      const tx = await nft.connect(owner).forgeMint(user.address, 1n, 0, 'MyHen', 0n);
      await expect(tx).to.emit(nft, 'Minted');
      expect(await nft.ownerOf(1n)).to.equal(user.address);
      const [eid, gender, name] = await nft.tokenData(1n);
      expect(eid).to.equal(1n);
      expect(gender).to.equal(0n);
      expect(name).to.equal('MyHen');
    });

    it('increments edition minted counter', async () => {
      await nft.connect(owner).setForge(owner.address);
      await nft.connect(owner).forgeMint(user.address, 1n, 0, 'A', 0n);
      const e = await nft.getEdition(1n);
      expect(e.minted).to.equal(1n);
    });

    it('reverts EditionSoldOut when maxSupply reached', async () => {
      await nft.connect(owner).registerEdition('LimitedHen', 'ipfs://L', 50, 50, 50, 1, 1, 0, 0, 0, 0, W_ALL);
      const edId = await nft.editionCount();
      await nft.connect(owner).setForge(owner.address);
      await nft.connect(owner).forgeMint(user.address, edId, 0, 'First', 0n);
      await expect(nft.connect(owner).forgeMint(user.address, edId, 0, 'Second', 0n)).to.be.revertedWithCustomError(
        nft,
        'EditionSoldOut',
      );
    });

    it('reverts when paused', async () => {
      await nft.connect(owner).setForge(owner.address);
      await nft.connect(owner).pause();
      await expect(nft.connect(owner).forgeMint(user.address, 1n, 0, 'A', 0n)).to.revert(ethers);
    });
  });

  describe('rename', () => {
    beforeEach(async () => {
      await nft.connect(owner).setForge(owner.address);
      await nft.connect(owner).forgeMint(user.address, 1n, 0, 'InitialName', 0n);
    });

    it('owner of token can rename and burns BCKN', async () => {
      await token.connect(owner).setEmissionCap(parseEther('2000000000'));
      const MINTER_ROLE = await token.MINTER_ROLE();
      await token.connect(owner).grantRole(MINTER_ROLE, owner.address);
      await token.connect(owner).mint(user.address, parseEther('100'));
      await token.connect(user).approve(await nft.getAddress(), parseEther('10'));

      const balBefore = await token.balanceOf(user.address);
      await expect(nft.connect(user).rename(1n, 'NewName'))
        .to.emit(nft, 'Renamed')
        .withArgs(1n, 'NewName', parseEther('10'));
      const balAfter = await token.balanceOf(user.address);
      expect(balBefore - balAfter).to.equal(parseEther('10'));
      const [, , name] = await nft.tokenData(1n);
      expect(name).to.equal('NewName');
    });

    it('reverts NotTokenOwner when caller does not own the token', async () => {
      await expect(nft.connect(user2).rename(1n, 'Hacked')).to.be.revertedWithCustomError(nft, 'NotTokenOwner');
    });

    it('reverts InvalidName on empty string', async () => {
      await expect(nft.connect(user).rename(1n, '')).to.be.revertedWithCustomError(nft, 'InvalidName');
    });

    it('reverts InvalidName on name > 24 chars', async () => {
      await expect(nft.connect(user).rename(1n, 'ABCDEFGHIJKLMNOPQRSTUVWXY')).to.be.revertedWithCustomError(
        nft,
        'InvalidName',
      );
    });

    it('reverts InvalidName on disallowed characters', async () => {
      await expect(nft.connect(user).rename(1n, 'Bad!Name')).to.be.revertedWithCustomError(nft, 'InvalidName');
    });

    it('accepts alphanumeric and spaces', async () => {
      await token.connect(owner).setEmissionCap(parseEther('2000000000'));
      const MINTER_ROLE = await token.MINTER_ROLE();
      await token.connect(owner).grantRole(MINTER_ROLE, owner.address);
      await token.connect(owner).mint(user.address, parseEther('100'));
      await token.connect(user).approve(await nft.getAddress(), parseEther('10'));
      await expect(nft.connect(user).rename(1n, 'Alpha Hen 1')).not.to.revert(ethers);
    });

    it('works with renamePrice=0 (free rename)', async () => {
      await nft.connect(owner).setRenamePrice(0n);
      await expect(nft.connect(user).rename(1n, 'FreeRename')).to.emit(nft, 'Renamed').withArgs(1n, 'FreeRename', 0n);
    });

    it('reverts when paused', async () => {
      await nft.connect(owner).pause();
      await expect(nft.connect(user).rename(1n, 'PausedName')).to.revert(ethers);
    });
  });

  describe('tokenURI', () => {
    it('returns a data-URI with base64 JSON', async () => {
      await nft.connect(owner).setForge(owner.address);
      await nft.connect(owner).forgeMint(user.address, 1n, 0, 'TestHen', 0n);
      const uri = await nft.tokenURI(1n);
      expect(uri.startsWith('data:application/json;base64,')).to.be.true;
      const decoded = Buffer.from(uri.slice('data:application/json;base64,'.length), 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as {
        name: string;
        image: string;
        attributes: { trait_type: string; value: unknown }[];
      };
      expect(parsed.image).to.equal('ipfs://CID1');
      expect(parsed.attributes.find((a) => a.trait_type === 'Health')?.value).to.equal(30);
      expect(parsed.attributes.find((a) => a.trait_type === 'Gender')?.value).to.equal('Male');
    });

    it('includes edition artURI as image', async () => {
      await nft.connect(owner).setForge(owner.address);
      await nft.connect(owner).forgeMint(user.address, 2n, 1, 'RareBird', 0n);
      const uri = await nft.tokenURI(1n);
      const decoded = Buffer.from(uri.slice('data:application/json;base64,'.length), 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as { image: string };
      expect(parsed.image).to.equal('ipfs://CID2');
    });

    it('reverts for non-existent token', async () => {
      await expect(nft.tokenURI(999n)).to.revert(ethers);
    });
  });

  describe('attributesOf', () => {
    it('returns edition stats and gender for a minted token', async () => {
      await nft.connect(owner).setForge(owner.address);
      await nft.connect(owner).forgeMint(user.address, 1n, 0, 'A', 0n);
      const [h, s, m, g] = await nft.attributesOf(1n);
      expect(h).to.equal(30n);
      expect(s).to.equal(30n);
      expect(m).to.equal(30n);
      expect(g).to.equal(0n);
    });

    it('stats match the edition exactly (not rolled)', async () => {
      await nft.connect(owner).setForge(owner.address);
      await nft.connect(owner).forgeMint(user.address, 2n, 1, 'B', 0n);
      const [h, s, m, g] = await nft.attributesOf(1n);
      expect(h).to.equal(60n);
      expect(s).to.equal(60n);
      expect(m).to.equal(60n);
      expect(g).to.equal(1n);
    });

    it('reverts for non-existent token', async () => {
      await expect(nft.attributesOf(999n)).to.revert(ethers);
    });
  });

  describe('editionOf', () => {
    it('returns correct edition id', async () => {
      await nft.connect(owner).setForge(owner.address);
      await nft.connect(owner).forgeMint(user.address, 2n, 0, 'B', 0n);
      expect(await nft.editionOf(1n)).to.equal(2n);
    });
  });

  describe('nextId', () => {
    it('starts at 1 and increments', async () => {
      expect(await nft.nextId()).to.equal(1n);
      await nft.connect(owner).setForge(owner.address);
      await nft.connect(owner).forgeMint(user.address, 1n, 0, 'A', 0n);
      expect(await nft.nextId()).to.equal(2n);
    });
  });

  describe('withdraw', () => {
    it('owner can withdraw BNB accumulated in the contract', async () => {
      await ethers.provider.send('hardhat_setBalance', [await nft.getAddress(), '0xDE0B6B3A7640000']);
      const before = await ethers.provider.getBalance(owner.address);
      const tx = await nft.connect(owner).withdraw();
      const rcpt = await tx.wait();
      const gas = rcpt!.gasUsed * rcpt!.gasPrice;
      const after = await ethers.provider.getBalance(owner.address);
      expect(after + gas - before).to.equal(parseEther('1'));
    });

    it('non-owner cannot withdraw', async () => {
      await expect(nft.connect(user).withdraw()).to.be.revertedWithCustomError(nft, 'OwnableUnauthorizedAccount');
    });

    it('reverts TransferFailed when owner rejects BNB', async () => {
      const connection = await hre.network.create();
      const api = await upgrades(hre, connection);
      const [o] = await connection.ethers.getSigners();
      const RejectF = await connection.ethers.getContractFactory('RejectEtherReceiver');
      const rejector = await RejectF.deploy();
      await rejector.waitForDeployment();
      const TF = await connection.ethers.getContractFactory('BitChickenToken');
      const tp = await api.deployProxy(TF, ['B', 'B', o.address, o.address, o.address], { initializer: 'initialize' });
      await tp.waitForDeployment();
      const NF = await connection.ethers.getContractFactory('BitChickenNFT');
      const np = await api.deployProxy(NF, [await rejector.getAddress(), await tp.getAddress()], {
        initializer: 'initialize',
      });
      await np.waitForDeployment();
      await connection.ethers.provider.send('hardhat_setBalance', [await np.getAddress(), '0xDE0B6B3A7640000']);
      const withdrawData = np.interface.encodeFunctionData('withdraw');
      await expect(rejector.execute(await np.getAddress(), withdrawData)).to.be.revertedWithCustomError(
        np,
        'TransferFailed',
      );
    });
  });

  describe('royalty', () => {
    it('owner can set royalty', async () => {
      await nft.connect(owner).setRoyalty(owner.address, 500);
      const [receiver, amount] = await nft.royaltyInfo(0n, parseEther('1'));
      expect(receiver).to.equal(owner.address);
      expect(amount).to.equal(parseEther('0.05'));
    });

    it('non-owner cannot set royalty', async () => {
      await expect(nft.connect(user).setRoyalty(user.address, 500)).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('updateTierPrices', () => {
    it('only owner', async () => {
      await expect(nft.connect(user).updateTierPrices(TIER_PRICES)).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );
    });

    it('emits TierPricesUpdated', async () => {
      await expect(nft.connect(owner).updateTierPrices(TIER_PRICES)).to.emit(nft, 'TierPricesUpdated');
    });

    it('rejects non-ascending prices', async () => {
      const bad = [...TIER_PRICES] as typeof TIER_PRICES;
      bad[5] = bad[4];
      await expect(nft.connect(owner).updateTierPrices(bad)).to.be.revertedWithCustomError(nft, 'InvalidTierPrices');
    });
  });

  describe('referral', () => {
    it('registerReferrer assigns code >= 1000', async () => {
      await nft.connect(user).registerReferrer();
      expect(await nft.getReferrerCode(user.address)).to.be.gte(1000n);
    });

    it('double registration reverts AlreadyRegistered', async () => {
      await nft.connect(user).registerReferrer();
      await expect(nft.connect(user).registerReferrer()).to.be.revertedWithCustomError(nft, 'AlreadyRegistered');
    });

    it('forgeMint links the referrer on the first egg and returns the reward rate', async () => {
      await nft.connect(user).registerReferrer();
      const code = await nft.getReferrerCode(user.address);
      await nft.connect(owner).setForge(owner.address);
      const res = await nft.connect(owner).forgeMint.staticCall(user2.address, 1n, 0, 'A', code);
      expect(res[1]).to.equal(user.address);
      expect(res[2]).to.equal(200n);
      await nft.connect(owner).forgeMint(user2.address, 1n, 0, 'A', code);
      await nft.connect(owner).setForge(await forge.getAddress());
      expect(await nft.getUpline(user2.address)).to.equal(user.address);
      expect(await nft.getReferredCount(user.address)).to.equal(1n);
    });
  });

  describe('pause/unpause', () => {
    it('owner can pause and unpause', async () => {
      await nft.connect(owner).pause();
      await nft.connect(owner).unpause();
      await nft.connect(owner).setForge(owner.address);
      await expect(nft.connect(owner).forgeMint(user.address, 1n, 0, 'A', 0n)).not.to.revert(ethers);
    });

    it('non-owner cannot pause', async () => {
      await expect(nft.connect(user).pause()).to.be.revertedWithCustomError(nft, 'OwnableUnauthorizedAccount');
    });
  });

  describe('supportsInterface', () => {
    it('supports ERC-721', async () => {
      expect(await nft.supportsInterface('0x80ac58cd')).to.be.true;
    });

    it('supports ERC-2981', async () => {
      expect(await nft.supportsInterface('0x2a55205a')).to.be.true;
    });
  });

  describe('Ownable2Step', () => {
    it('transferOwnership does not immediately change owner', async () => {
      await nft.connect(owner).transferOwnership(user.address);
      expect(await nft.owner()).to.equal(owner.address);
    });

    it('transferOwnership sets pendingOwner', async () => {
      await nft.connect(owner).transferOwnership(user.address);
      expect(await nft.pendingOwner()).to.equal(user.address);
    });

    it('emits OwnershipTransferStarted', async () => {
      await expect(nft.connect(owner).transferOwnership(user.address))
        .to.emit(nft, 'OwnershipTransferStarted')
        .withArgs(owner.address, user.address);
    });

    it('acceptOwnership by pendingOwner finalises transfer', async () => {
      await nft.connect(owner).transferOwnership(user.address);
      await nft.connect(user).acceptOwnership();
      expect(await nft.owner()).to.equal(user.address);
      expect(await nft.pendingOwner()).to.equal(ethers.ZeroAddress);
    });

    it('onlyOwner functions still enforce current owner during pending', async () => {
      await nft.connect(owner).transferOwnership(user.address);
      await expect(nft.connect(user).pause()).to.be.revertedWithCustomError(nft, 'OwnableUnauthorizedAccount');
      await expect(nft.connect(owner).pause()).not.to.revert(ethers);
    });

    it('rejects acceptOwnership from non-pendingOwner', async () => {
      await nft.connect(owner).transferOwnership(user.address);
      await expect(nft.connect(other).acceptOwnership()).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );
    });

    it('non-owner cannot call transferOwnership', async () => {
      await expect(nft.connect(user).transferOwnership(user2.address)).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );
    });
  });
});

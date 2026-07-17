import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';
import { expect } from 'chai';
import { parseEther, ZeroAddress } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { BitChickenNFT } from '../types/ethers-contracts/bitchicken-nft.sol/BitChickenNFT.js';
import type { BitChickenMarketplace } from '../types/ethers-contracts/bitchicken-marketplace.sol/BitChickenMarketplace.js';

const PLATFORM_FEE_BPS = 250n;
const ROYALTY_BPS = 500;
const LISTING_PRICE = parseEther('1.0');
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

describe('BitChickenMarketplace', () => {
  let nft: BitChickenNFT;
  let market: BitChickenMarketplace;
  let owner: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let feeSink: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let provider: Awaited<ReturnType<typeof hre.network.create>>['ethers']['provider'];
  let ethers: Awaited<ReturnType<typeof hre.network.create>>['ethers'];

  async function deployAll() {
    const connection = await hre.network.create();
    ethers = connection.ethers;
    provider = ethers.provider;
    const api = await upgrades(hre, connection);
    [owner, seller, buyer, feeSink, other] = await ethers.getSigners();

    const TokenF = await ethers.getContractFactory('BitChickenToken');
    const tokenProxy = await api.deployProxy(
      TokenF,
      ['BitChicken', 'BCK', owner.address, owner.address, owner.address],
      { initializer: 'initialize' },
    );
    await tokenProxy.waitForDeployment();

    const NftF = await ethers.getContractFactory('BitChickenNFT');
    const nftProxy = await api.deployProxy(NftF, [owner.address, await tokenProxy.getAddress()], {
      initializer: 'initialize',
    });
    await nftProxy.waitForDeployment();
    nft = nftProxy as unknown as BitChickenNFT;

    await nft.connect(owner).updateTierPrices(TIER_PRICES);
    await nft.connect(owner).registerEdition('Common Hen', 'ipfs://CID1', 30, 40, 50, 1, 0, 0, 0, 0, 0, W_ALL);
    await nft.connect(owner).setRoyalty(owner.address, ROYALTY_BPS);
    await nft.connect(owner).setForge(owner.address);

    const MarketF = await ethers.getContractFactory('BitChickenMarketplace');
    const marketProxy = await api.deployProxy(
      MarketF,
      [owner.address, await nft.getAddress(), feeSink.address, PLATFORM_FEE_BPS],
      { initializer: 'initialize' },
    );
    await marketProxy.waitForDeployment();
    market = marketProxy as unknown as BitChickenMarketplace;
  }

  async function mintNFTFor(signer: HardhatEthersSigner): Promise<bigint> {
    const nextId = await nft.nextId();
    await nft.connect(owner).forgeMint(signer.address, 1n, 0, 'TestHen', 0n);
    await nft.connect(signer).setApprovalForAll(await market.getAddress(), true);
    return nextId;
  }

  async function mintNFTWithoutApproval(signer: HardhatEthersSigner): Promise<bigint> {
    const nextId = await nft.nextId();
    await nft.connect(owner).forgeMint(signer.address, 1n, 0, 'TestHen', 0n);
    return nextId;
  }

  beforeEach(async () => {
    await deployAll();
  });

  describe('initialize', () => {
    it('sets owner', async () => {
      expect(await market.owner()).to.equal(owner.address);
    });

    it('sets fee config', async () => {
      const [sink, bps] = await market.getFeeConfig();
      expect(sink).to.equal(feeSink.address);
      expect(bps).to.equal(PLATFORM_FEE_BPS);
    });

    it('reverts ZeroAddress on zero owner', async () => {
      const connection = await hre.network.create();
      const api = await upgrades(hre, connection);
      const F = await connection.ethers.getContractFactory('BitChickenMarketplace');
      await expect(
        api.deployProxy(F, [ZeroAddress, await nft.getAddress(), feeSink.address, 0], { initializer: 'initialize' }),
      ).to.be.revertedWithCustomError(market, 'ZeroAddress');
    });

    it('reverts ZeroAddress on zero nft', async () => {
      const connection = await hre.network.create();
      const api = await upgrades(hre, connection);
      const [o] = await connection.ethers.getSigners();
      const F = await connection.ethers.getContractFactory('BitChickenMarketplace');
      await expect(
        api.deployProxy(F, [o.address, ZeroAddress, feeSink.address, 0], { initializer: 'initialize' }),
      ).to.be.revertedWithCustomError(market, 'ZeroAddress');
    });

    it('reverts ZeroAddress on zero feeSink', async () => {
      const connection = await hre.network.create();
      const api = await upgrades(hre, connection);
      const [o] = await connection.ethers.getSigners();
      const F = await connection.ethers.getContractFactory('BitChickenMarketplace');
      await expect(
        api.deployProxy(F, [o.address, await nft.getAddress(), ZeroAddress, 0], { initializer: 'initialize' }),
      ).to.be.revertedWithCustomError(market, 'ZeroAddress');
    });

    it('reverts InvalidBasisPoints when bps > 10000', async () => {
      const connection = await hre.network.create();
      const api = await upgrades(hre, connection);
      const [o] = await connection.ethers.getSigners();
      const F = await connection.ethers.getContractFactory('BitChickenMarketplace');
      await expect(
        api.deployProxy(F, [o.address, await nft.getAddress(), feeSink.address, 10001], { initializer: 'initialize' }),
      ).to.be.revertedWithCustomError(market, 'InvalidBasisPoints');
    });
  });

  describe('setPlatformFee', () => {
    it('owner can update fee', async () => {
      await expect(market.connect(owner).setPlatformFee(feeSink.address, 300n))
        .to.emit(market, 'FeeUpdated')
        .withArgs(feeSink.address, 300n);
      const [, bps] = await market.getFeeConfig();
      expect(bps).to.equal(300n);
    });

    it('non-owner cannot update fee', async () => {
      await expect(market.connect(seller).setPlatformFee(feeSink.address, 100n)).to.be.revertedWithCustomError(
        market,
        'OwnableUnauthorizedAccount',
      );
    });

    it('reverts ZeroAddress on zero feeSink', async () => {
      await expect(market.connect(owner).setPlatformFee(ZeroAddress, 100n)).to.be.revertedWithCustomError(
        market,
        'ZeroAddress',
      );
    });

    it('reverts InvalidBasisPoints when bps > 10000', async () => {
      await expect(market.connect(owner).setPlatformFee(feeSink.address, 10001n)).to.be.revertedWithCustomError(
        market,
        'InvalidBasisPoints',
      );
    });
  });

  describe('list', () => {
    it('seller can list an NFT they own', async () => {
      const tokenId = await mintNFTFor(seller);
      await expect(market.connect(seller).list(tokenId, LISTING_PRICE))
        .to.emit(market, 'Listed')
        .withArgs(tokenId, seller.address, LISTING_PRICE);
    });

    it('list emits Listed with correct seller and price', async () => {
      const tokenId = await mintNFTFor(seller);
      await expect(market.connect(seller).list(tokenId, LISTING_PRICE))
        .to.emit(market, 'Listed')
        .withArgs(tokenId, seller.address, LISTING_PRICE);
    });

    it('reverts ZeroPrice on zero price', async () => {
      const tokenId = await mintNFTFor(seller);
      await expect(market.connect(seller).list(tokenId, 0n)).to.be.revertedWithCustomError(market, 'ZeroPrice');
    });

    it('reverts NotTokenOwner when caller does not own the token', async () => {
      const tokenId = await mintNFTFor(seller);
      await expect(market.connect(buyer).list(tokenId, LISTING_PRICE)).to.be.revertedWithCustomError(
        market,
        'NotTokenOwner',
      );
    });

    it('reverts AlreadyListed when token has an active listing', async () => {
      const tokenId = await mintNFTFor(seller);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      await expect(market.connect(seller).list(tokenId, LISTING_PRICE)).to.be.revertedWithCustomError(
        market,
        'AlreadyListed',
      );
    });

    it('reverts NotApproved when marketplace is not approved (fail-fast, no dead listings)', async () => {
      const tokenId = await mintNFTWithoutApproval(other);
      await expect(market.connect(other).list(tokenId, LISTING_PRICE)).to.be.revertedWithCustomError(
        market,
        'NotApproved',
      );
    });

    it('reverts when paused', async () => {
      const tokenId = await mintNFTFor(seller);
      await market.connect(owner).pause();
      await expect(market.connect(seller).list(tokenId, LISTING_PRICE)).to.revert(ethers);
    });
  });

  describe('cancel', () => {
    it('seller can cancel their listing', async () => {
      const tokenId = await mintNFTFor(seller);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      await expect(market.connect(seller).cancel(tokenId))
        .to.emit(market, 'Cancelled')
        .withArgs(tokenId, seller.address);
      await expect(market.connect(seller).cancel(tokenId)).to.be.revertedWithCustomError(market, 'NotListed');
    });

    it('reverts NotListed when no active listing', async () => {
      const tokenId = await mintNFTFor(seller);
      await expect(market.connect(seller).cancel(tokenId)).to.be.revertedWithCustomError(market, 'NotListed');
    });

    it('reverts NotSeller when called by non-seller', async () => {
      const tokenId = await mintNFTFor(seller);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      await expect(market.connect(buyer).cancel(tokenId)).to.be.revertedWithCustomError(market, 'NotSeller');
    });
  });

  describe('obtain', () => {
    it('buyer purchases listed NFT with correct payment split', async () => {
      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);

      const feeSinkBefore = await provider.getBalance(feeSink.address);
      const sellerBefore = await provider.getBalance(seller.address);

      const tx = await market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE });
      await tx.wait();

      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);

      const platformFee = (LISTING_PRICE * PLATFORM_FEE_BPS) / 10000n;
      const [, royaltyAmt] = await nft.royaltyInfo(tokenId, LISTING_PRICE);
      const sellerProceeds = LISTING_PRICE - platformFee - royaltyAmt;

      const feeSinkAfter = await provider.getBalance(feeSink.address);
      expect(feeSinkAfter - feeSinkBefore).to.equal(platformFee);

      const sellerAfter = await provider.getBalance(seller.address);
      expect(sellerAfter - sellerBefore).to.equal(sellerProceeds);
    });

    it('emits Sold with correct args', async () => {
      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      const platformFee = (LISTING_PRICE * PLATFORM_FEE_BPS) / 10000n;
      const [, royaltyAmt] = await nft.royaltyInfo(tokenId, LISTING_PRICE);
      await expect(market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE }))
        .to.emit(market, 'Sold')
        .withArgs(tokenId, seller.address, buyer.address, LISTING_PRICE, platformFee, royaltyAmt);
    });

    it('refunds excess BNB to buyer', async () => {
      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      const excess = parseEther('0.5');
      const buyerBefore = await provider.getBalance(buyer.address);
      const tx = await market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE + excess });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const buyerAfter = await provider.getBalance(buyer.address);
      expect(buyerBefore - buyerAfter - gasUsed).to.equal(LISTING_PRICE);
    });

    it('clears listing after purchase (obtain on already-bought token reverts NotListed)', async () => {
      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      await market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE });
      await expect(market.connect(other).obtain(tokenId, { value: LISTING_PRICE })).to.be.revertedWithCustomError(
        market,
        'NotListed',
      );
    });

    it('reverts NotListed when no active listing', async () => {
      const tokenId = await mintNFTFor(seller);
      await expect(market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE })).to.be.revertedWithCustomError(
        market,
        'NotListed',
      );
    });

    it('reverts InsufficientPayment when msg.value < price', async () => {
      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      await expect(market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE - 1n })).to.be.revertedWithCustomError(
        market,
        'InsufficientPayment',
      );
    });

    it('reverts NotTokenOwner when seller transferred NFT away after listing', async () => {
      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      await nft.connect(seller).transferFrom(seller.address, other.address, tokenId);
      await expect(market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE })).to.be.revertedWithCustomError(
        market,
        'NotTokenOwner',
      );
    });

    it('reverts NotApproved when seller revoked approval after listing', async () => {
      const tokenId = await mintNFTFor(seller);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), false);
      await expect(market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE })).to.be.revertedWithCustomError(
        market,
        'NotApproved',
      );
    });

    it('reverts when paused', async () => {
      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      await market.connect(owner).pause();
      await expect(market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE })).to.revert(ethers);
    });

    it('reverts FeesExceedPrice when combined platform fee + royalty exceeds listing price', async () => {
      await market.connect(owner).setPlatformFee(feeSink.address, 9600n);
      const tokenId = await mintNFTFor(seller);
      const lowPrice = parseEther('0.001');
      await market.connect(seller).list(tokenId, lowPrice);
      await expect(market.connect(buyer).obtain(tokenId, { value: lowPrice })).to.be.revertedWithCustomError(
        market,
        'FeesExceedPrice',
      );
    });

    it('reverts TransferFailed when feeSink rejects BNB', async () => {
      const connection = await hre.network.create();
      const api = await upgrades(hre, connection);
      const [o, s, b] = await connection.ethers.getSigners();
      const TF = await connection.ethers.getContractFactory('BitChickenToken');
      const tp = await api.deployProxy(TF, ['B', 'B', o.address, o.address, o.address], { initializer: 'initialize' });
      await tp.waitForDeployment();
      const NF = await connection.ethers.getContractFactory('BitChickenNFT');
      const np = await api.deployProxy(NF, [o.address, await tp.getAddress()], {
        initializer: 'initialize',
      });
      await np.waitForDeployment();
      const localNft = np as unknown as BitChickenNFT;
      await localNft.connect(o).registerEdition('Hen', 'ipfs://X', 30, 40, 50, 1, 0, 0, 0, 0, 0, W_ALL);
      await localNft.connect(o).setForge(o.address);
      const RejectF = await connection.ethers.getContractFactory('RejectEtherReceiver');
      const rejector = await RejectF.deploy();
      await rejector.waitForDeployment();
      const MF = await connection.ethers.getContractFactory('BitChickenMarketplace');
      const mp = await api.deployProxy(
        MF,
        [o.address, await localNft.getAddress(), await rejector.getAddress(), PLATFORM_FEE_BPS],
        { initializer: 'initialize' },
      );
      await mp.waitForDeployment();
      const localMarket = mp as unknown as BitChickenMarketplace;
      const tokenId = await localNft.nextId();
      await localNft.connect(o).forgeMint(s.address, 1n, 0, 'Hen', 0n);
      await localNft.connect(s).setApprovalForAll(await localMarket.getAddress(), true);
      await localMarket.connect(s).list(tokenId, LISTING_PRICE);
      await expect(localMarket.connect(b).obtain(tokenId, { value: LISTING_PRICE })).to.be.revertedWithCustomError(
        localMarket,
        'TransferFailed',
      );
    });
  });

  describe('proposeSwap / acceptSwap / cancelSwap', () => {
    it('proposer can propose a swap and emits SwapProposed', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      await expect(market.connect(seller).proposeSwap(tokenA, tokenB))
        .to.emit(market, 'SwapProposed')
        .withArgs(1n, seller.address, tokenA, tokenB, 0n);
    });

    it('getSwap returns the active proposal', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      await market.connect(seller).proposeSwap(tokenA, tokenB);
      const s = await market.getSwap(1n);
      expect(s.proposer).to.equal(seller.address);
      expect(s.offeredId).to.equal(tokenA);
      expect(s.wantedId).to.equal(tokenB);
      expect(s.bnbLeg).to.equal(0n);
    });

    it('proposer can attach a BNB leg', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      const bnbLeg = parseEther('0.5');
      await expect(market.connect(seller).proposeSwap(tokenA, tokenB, { value: bnbLeg }))
        .to.emit(market, 'SwapProposed')
        .withArgs(1n, seller.address, tokenA, tokenB, bnbLeg);
    });

    it('proposer can cancel and get BNB leg refunded', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      const bnbLeg = parseEther('0.5');
      await market.connect(seller).proposeSwap(tokenA, tokenB, { value: bnbLeg });
      const sellerBefore = await provider.getBalance(seller.address);
      const tx = await market.connect(seller).cancelSwap(1n);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const sellerAfter = await provider.getBalance(seller.address);
      expect(sellerAfter - sellerBefore + gasUsed).to.equal(bnbLeg);
    });

    it('cancelSwap emits SwapCancelled', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      await market.connect(seller).proposeSwap(tokenA, tokenB);
      await expect(market.connect(seller).cancelSwap(1n)).to.emit(market, 'SwapCancelled').withArgs(1n, seller.address);
    });

    it('cancelSwap reverts SwapNotFound when not found', async () => {
      await expect(market.connect(seller).cancelSwap(999n)).to.be.revertedWithCustomError(market, 'SwapNotFound');
    });

    it('cancelSwap reverts NotProposer when non-proposer calls', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      await market.connect(seller).proposeSwap(tokenA, tokenB);
      await expect(market.connect(buyer).cancelSwap(1n)).to.be.revertedWithCustomError(market, 'NotProposer');
    });

    it('acceptSwap exchanges NFTs atomically and emits SwapAccepted', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await nft.connect(buyer).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).proposeSwap(tokenA, tokenB);
      await expect(market.connect(buyer).acceptSwap(1n))
        .to.emit(market, 'SwapAccepted')
        .withArgs(1n, seller.address, buyer.address, tokenA, tokenB);
      expect(await nft.ownerOf(tokenA)).to.equal(buyer.address);
      expect(await nft.ownerOf(tokenB)).to.equal(seller.address);
    });

    it('acceptSwap forwards BNB leg to acceptor', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await nft.connect(buyer).setApprovalForAll(await market.getAddress(), true);
      const bnbLeg = parseEther('0.5');
      await market.connect(seller).proposeSwap(tokenA, tokenB, { value: bnbLeg });
      const buyerBefore = await provider.getBalance(buyer.address);
      const tx = await market.connect(buyer).acceptSwap(1n);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const buyerAfter = await provider.getBalance(buyer.address);
      expect(buyerAfter - buyerBefore + gasUsed).to.equal(bnbLeg);
    });

    it('acceptSwap reverts SwapNotFound when not found', async () => {
      await expect(market.connect(buyer).acceptSwap(999n)).to.be.revertedWithCustomError(market, 'SwapNotFound');
    });

    it('acceptSwap reverts NotWantedOwner when acceptor does not own wantedId', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      await market.connect(seller).proposeSwap(tokenA, tokenB);
      await expect(market.connect(other).acceptSwap(1n)).to.be.revertedWithCustomError(market, 'NotWantedOwner');
    });

    it('acceptSwap reverts ProposerLostToken when proposer no longer owns offeredId', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      await market.connect(seller).proposeSwap(tokenA, tokenB);
      await nft.connect(seller).transferFrom(seller.address, other.address, tokenA);
      await nft.connect(buyer).setApprovalForAll(await market.getAddress(), true);
      await expect(market.connect(buyer).acceptSwap(1n)).to.be.revertedWithCustomError(market, 'ProposerLostToken');
    });

    it('acceptSwap reverts NotApproved when proposer has no approval', async () => {
      const tokenA = await mintNFTWithoutApproval(seller);
      const tokenB = await mintNFTFor(buyer);
      await market.connect(seller).proposeSwap(tokenA, tokenB);
      await expect(market.connect(buyer).acceptSwap(1n)).to.be.revertedWithCustomError(market, 'NotApproved');
    });

    it('acceptSwap reverts NotApproved when acceptor has no approval', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTWithoutApproval(buyer);
      await market.connect(seller).proposeSwap(tokenA, tokenB);
      await expect(market.connect(buyer).acceptSwap(1n)).to.be.revertedWithCustomError(market, 'NotApproved');
    });

    it('acceptSwap reverts when paused', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await nft.connect(buyer).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).proposeSwap(tokenA, tokenB);
      await market.connect(owner).pause();
      await expect(market.connect(buyer).acceptSwap(1n)).to.revert(ethers);
    });

    it('reverts NotTokenOwner on proposeSwap when caller does not own offeredId', async () => {
      const tokenA = await mintNFTFor(seller);
      const tokenB = await mintNFTFor(buyer);
      await expect(market.connect(buyer).proposeSwap(tokenA, tokenB)).to.be.revertedWithCustomError(
        market,
        'NotTokenOwner',
      );
    });
  });

  describe('C1–C5: exact BNB accounting, edge cases and self-buy behavior', () => {
    it('C1: 3-way exact BNB split — platformFee + royalty + sellerProceeds == price exactly', async () => {
      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);

      const platformFee = (LISTING_PRICE * PLATFORM_FEE_BPS) / 10000n;
      const [royaltyReceiver, royaltyAmt] = await nft.royaltyInfo(tokenId, LISTING_PRICE);
      const sellerProceeds = LISTING_PRICE - platformFee - royaltyAmt;

      const feeSinkBefore = await provider.getBalance(feeSink.address);
      const royaltyReceiverBefore = await provider.getBalance(royaltyReceiver);
      const sellerBefore = await provider.getBalance(seller.address);

      await market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE });

      const feeSinkDelta = (await provider.getBalance(feeSink.address)) - feeSinkBefore;
      const royaltyDelta = (await provider.getBalance(royaltyReceiver)) - royaltyReceiverBefore;
      const sellerDelta = (await provider.getBalance(seller.address)) - sellerBefore;

      expect(feeSinkDelta).to.equal(platformFee);
      expect(royaltyDelta).to.equal(royaltyAmt);
      expect(sellerDelta).to.equal(sellerProceeds);
      expect(feeSinkDelta + royaltyDelta + sellerDelta).to.equal(LISTING_PRICE);
    });

    it('C2: zero-fee edge — platformFeeBps=0, royalty=0 → seller receives entire price', async () => {
      await market.connect(owner).setPlatformFee(feeSink.address, 0n);
      await nft.connect(owner).setRoyalty(owner.address, 0n);

      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);

      const sellerBefore = await provider.getBalance(seller.address);
      await market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE });
      const sellerAfter = await provider.getBalance(seller.address);

      expect(sellerAfter - sellerBefore).to.equal(LISTING_PRICE);

      await market.connect(owner).setPlatformFee(feeSink.address, PLATFORM_FEE_BPS);
      await nft.connect(owner).setRoyalty(owner.address, ROYALTY_BPS);
    });

    it('C3: re-listing after cancel succeeds at a different price', async () => {
      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);

      await market.connect(seller).list(tokenId, LISTING_PRICE);
      await market.connect(seller).cancel(tokenId);

      const newPrice = LISTING_PRICE / 2n;
      await expect(market.connect(seller).list(tokenId, newPrice))
        .to.emit(market, 'Listed')
        .withArgs(tokenId, seller.address, newPrice);
    });

    it('C4: cancel after sold reverts NotListed', async () => {
      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);
      await market.connect(buyer).obtain(tokenId, { value: LISTING_PRICE });

      await expect(market.connect(seller).cancel(tokenId)).to.be.revertedWithCustomError(market, 'NotListed');
    });

    it('C5: seller obtains own listing — self-transfer succeeds, seller pays net fees', async () => {
      await market.connect(owner).setPlatformFee(feeSink.address, PLATFORM_FEE_BPS);
      await nft.connect(owner).setRoyalty(owner.address, ROYALTY_BPS);

      const tokenId = await mintNFTFor(seller);
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller).list(tokenId, LISTING_PRICE);

      const platformFee = (LISTING_PRICE * PLATFORM_FEE_BPS) / 10000n;
      const [, royaltyAmt] = await nft.royaltyInfo(tokenId, LISTING_PRICE);

      const sellerBefore = await provider.getBalance(seller.address);
      const feeSinkBefore = await provider.getBalance(feeSink.address);

      const tx = await market.connect(seller).obtain(tokenId, { value: LISTING_PRICE });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

      const feeSinkAfter = await provider.getBalance(feeSink.address);
      expect(feeSinkAfter - feeSinkBefore).to.equal(platformFee);

      const sellerAfter = await provider.getBalance(seller.address);
      const sellerNetCost = LISTING_PRICE - (LISTING_PRICE - platformFee - royaltyAmt);
      expect(sellerBefore - sellerAfter - gasUsed).to.equal(sellerNetCost);
    });
  });

  describe('pause / unpause', () => {
    it('only owner can pause', async () => {
      await expect(market.connect(seller).pause()).to.be.revertedWithCustomError(market, 'OwnableUnauthorizedAccount');
    });

    it('only owner can unpause', async () => {
      await market.connect(owner).pause();
      await expect(market.connect(seller).unpause()).to.be.revertedWithCustomError(
        market,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Ownable2Step', () => {
    it('transferOwnership does not immediately change owner', async () => {
      await market.connect(owner).transferOwnership(seller.address);
      expect(await market.owner()).to.equal(owner.address);
    });

    it('transferOwnership sets pendingOwner', async () => {
      await market.connect(owner).transferOwnership(seller.address);
      expect(await market.pendingOwner()).to.equal(seller.address);
    });

    it('emits OwnershipTransferStarted', async () => {
      await expect(market.connect(owner).transferOwnership(seller.address))
        .to.emit(market, 'OwnershipTransferStarted')
        .withArgs(owner.address, seller.address);
    });

    it('acceptOwnership by pendingOwner finalises transfer', async () => {
      await market.connect(owner).transferOwnership(seller.address);
      await market.connect(seller).acceptOwnership();
      expect(await market.owner()).to.equal(seller.address);
      expect(await market.pendingOwner()).to.equal(ethers.ZeroAddress);
    });

    it('onlyOwner functions enforce current owner during pending', async () => {
      await market.connect(owner).transferOwnership(seller.address);
      await expect(market.connect(seller).setPlatformFee(feeSink.address, 100n)).to.be.revertedWithCustomError(
        market,
        'OwnableUnauthorizedAccount',
      );
      await expect(market.connect(owner).setPlatformFee(feeSink.address, 100n)).not.to.revert(ethers);
    });

    it('rejects acceptOwnership from non-pendingOwner', async () => {
      await market.connect(owner).transferOwnership(seller.address);
      await expect(market.connect(other).acceptOwnership()).to.be.revertedWithCustomError(
        market,
        'OwnableUnauthorizedAccount',
      );
    });

    it('non-owner cannot call transferOwnership', async () => {
      await expect(market.connect(seller).transferOwnership(buyer.address)).to.be.revertedWithCustomError(
        market,
        'OwnableUnauthorizedAccount',
      );
    });
  });
});

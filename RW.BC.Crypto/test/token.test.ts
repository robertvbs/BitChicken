import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';
import { expect } from 'chai';
import { parseEther } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { BitChickenToken } from '../types/contracts/bitchicken-token.js';

const CAP = parseEther('1000000000');

describe('BitChickenToken', () => {
  let token: BitChickenToken;
  let admin: HardhatEthersSigner;
  let pauser: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let ethers: Awaited<ReturnType<typeof hre.network.create>>['ethers'];

  async function deploy() {
    const connection = await hre.network.create();
    ethers = connection.ethers;
    const api = await upgrades(hre, connection);
    [admin, pauser, minter, user, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('BitChickenToken');
    const proxy = await api.deployProxy(Factory, ['BitChicken', 'BCK', admin.address, pauser.address, minter.address], {
      initializer: 'initialize',
    });
    await proxy.waitForDeployment();
    token = proxy as unknown as BitChickenToken;
  }

  beforeEach(async () => {
    await deploy();
  });

  describe('initialize', () => {
    it('sets name and symbol', async () => {
      expect(await token.name()).to.equal('BitChicken');
      expect(await token.symbol()).to.equal('BCK');
    });

    it('grants DEFAULT_ADMIN_ROLE to admin', async () => {
      const role = await token.DEFAULT_ADMIN_ROLE();
      expect(await token.hasRole(role, admin.address)).to.be.true;
    });

    it('grants PAUSER_ROLE to pauser', async () => {
      const role = await token.PAUSER_ROLE();
      expect(await token.hasRole(role, pauser.address)).to.be.true;
    });

    it('grants MINTER_ROLE to minter', async () => {
      const role = await token.MINTER_ROLE();
      expect(await token.hasRole(role, minter.address)).to.be.true;
    });

    it('starts with zero emission cap', async () => {
      expect(await token.emissionCap()).to.equal(0n);
    });

    it('starts with zero totalMinted', async () => {
      expect(await token.totalMinted()).to.equal(0n);
    });
  });

  describe('setEmissionCap', () => {
    it('admin can set cap', async () => {
      await expect(token.connect(admin).setEmissionCap(CAP)).to.emit(token, 'EmissionCapUpdated').withArgs(0n, CAP);
      expect(await token.emissionCap()).to.equal(CAP);
    });

    it('non-admin cannot set cap', async () => {
      await expect(token.connect(user).setEmissionCap(CAP)).to.revert(ethers);
    });

    it('reverts CapBelowTotalMinted when new cap < totalMinted', async () => {
      await token.connect(admin).setEmissionCap(CAP);
      const mintAmt = parseEther('100');
      await token.connect(minter).mint(user.address, mintAmt);
      await expect(token.connect(admin).setEmissionCap(mintAmt - 1n)).to.be.revertedWithCustomError(
        token,
        'CapBelowTotalMinted',
      );
    });

    it('allows setting cap equal to totalMinted', async () => {
      await token.connect(admin).setEmissionCap(CAP);
      const mintAmt = parseEther('100');
      await token.connect(minter).mint(user.address, mintAmt);
      await expect(token.connect(admin).setEmissionCap(mintAmt)).not.to.revert(ethers);
    });
  });

  describe('mint', () => {
    beforeEach(async () => {
      await token.connect(admin).setEmissionCap(CAP);
    });

    it('minter can mint tokens', async () => {
      const amt = parseEther('1000');
      await token.connect(minter).mint(user.address, amt);
      expect(await token.balanceOf(user.address)).to.equal(amt);
    });

    it('increments totalMinted', async () => {
      const amt = parseEther('500');
      await token.connect(minter).mint(user.address, amt);
      expect(await token.totalMinted()).to.equal(amt);
    });

    it('non-minter cannot mint', async () => {
      await expect(token.connect(user).mint(user.address, 1n)).to.revert(ethers);
    });

    it('reverts EmissionCapExceeded when mint exceeds cap', async () => {
      const overCap = CAP + 1n;
      await expect(token.connect(minter).mint(user.address, overCap)).to.be.revertedWithCustomError(
        token,
        'EmissionCapExceeded',
      );
    });

    it('can mint exactly up to cap', async () => {
      await expect(token.connect(minter).mint(user.address, CAP)).not.to.revert(ethers);
      expect(await token.totalMinted()).to.equal(CAP);
    });

    it('cannot mint after cap reached', async () => {
      await token.connect(minter).mint(user.address, CAP);
      await expect(token.connect(minter).mint(user.address, 1n)).to.be.revertedWithCustomError(
        token,
        'EmissionCapExceeded',
      );
    });
  });

  describe('pause / unpause', () => {
    beforeEach(async () => {
      await token.connect(admin).setEmissionCap(CAP);
      await token.connect(minter).mint(user.address, parseEther('100'));
    });

    it('pauser can pause', async () => {
      await token.connect(pauser).pause();
      await expect(token.connect(user).transfer(other.address, 1n)).to.revert(ethers);
    });

    it('pauser can unpause', async () => {
      await token.connect(pauser).pause();
      await token.connect(pauser).unpause();
      await expect(token.connect(user).transfer(other.address, 1n)).not.to.revert(ethers);
    });

    it('non-pauser cannot pause', async () => {
      await expect(token.connect(user).pause()).to.revert(ethers);
    });

    it('non-pauser cannot unpause', async () => {
      await token.connect(pauser).pause();
      await expect(token.connect(user).unpause()).to.revert(ethers);
    });
  });

  describe('burn', () => {
    beforeEach(async () => {
      await token.connect(admin).setEmissionCap(CAP);
      await token.connect(minter).mint(user.address, parseEther('1000'));
    });

    it('user can burn their own tokens', async () => {
      const bal = await token.balanceOf(user.address);
      const burnAmt = parseEther('100');
      await token.connect(user).burn(burnAmt);
      expect(await token.balanceOf(user.address)).to.equal(bal - burnAmt);
    });

    it('burn reduces totalSupply not totalMinted', async () => {
      const minted = await token.totalMinted();
      const burnAmt = parseEther('100');
      await token.connect(user).burn(burnAmt);
      expect(await token.totalMinted()).to.equal(minted);
      expect(await token.totalSupply()).to.equal(minted - burnAmt);
    });
  });

  describe('MINTER_ROLE management', () => {
    it('admin can grant MINTER_ROLE to another address', async () => {
      const role = await token.MINTER_ROLE();
      await token.connect(admin).grantRole(role, other.address);
      expect(await token.hasRole(role, other.address)).to.be.true;
    });

    it('admin can revoke MINTER_ROLE', async () => {
      const role = await token.MINTER_ROLE();
      await token.connect(admin).revokeRole(role, minter.address);
      await token.connect(admin).setEmissionCap(CAP);
      await expect(token.connect(minter).mint(user.address, 1n)).to.revert(ethers);
    });
  });
});

import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';
import { expect } from 'chai';
import { parseEther } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('Upgradeability (E2E)', () => {
  async function deployTokenProxy() {
    const connection = await hre.network.create();
    const { ethers } = connection;
    const api = await upgrades(hre, connection);
    const signers = await ethers.getSigners();
    const owner: HardhatEthersSigner = signers[0];
    const user: HardhatEthersSigner = signers[1];

    const TokenF = await ethers.getContractFactory('BitChickenToken');
    const proxy = await api.deployProxy(TokenF, ['BitChicken', 'BCK', owner.address, owner.address, owner.address], {
      initializer: 'initialize',
    });
    await proxy.waitForDeployment();
    return { ethers, api, owner, user, proxy };
  }

  it('upgradeProxy preserves state and exposes new behavior (Token V1 -> V2)', async () => {
    const { ethers, api, owner, user, proxy } = await deployTokenProxy();
    const token = proxy as unknown as {
      connect: (s: HardhatEthersSigner) => {
        setEmissionCap: (cap: bigint) => Promise<{ wait: () => Promise<unknown> }>;
        mint: (to: string, amount: bigint) => Promise<{ wait: () => Promise<unknown> }>;
      };
      getAddress: () => Promise<string>;
    };

    await (await token.connect(owner).setEmissionCap(parseEther('1000'))).wait();
    await (await token.connect(owner).mint(user.address, parseEther('100'))).wait();
    const proxyAddress = await token.getAddress();

    const V2 = await ethers.getContractFactory('BitChickenTokenV2');
    const upgraded = await api.upgradeProxy(proxyAddress, V2, { unsafeAllow: ['missing-initializer'] });
    await upgraded.waitForDeployment();
    const v2 = upgraded as unknown as {
      getAddress: () => Promise<string>;
      balanceOf: (a: string) => Promise<bigint>;
      totalMinted: () => Promise<bigint>;
      emissionCap: () => Promise<bigint>;
      version: () => Promise<string>;
    };

    expect(await v2.getAddress()).to.equal(proxyAddress);
    expect(await v2.balanceOf(user.address)).to.equal(parseEther('100'));
    expect(await v2.totalMinted()).to.equal(parseEther('100'));
    expect(await v2.emissionCap()).to.equal(parseEther('1000'));
    expect(await v2.version()).to.equal('v2');
  });

  it('rejects an upgrade-unsafe implementation (selfdestruct)', async () => {
    const { ethers, api, proxy } = await deployTokenProxy();
    const proxyAddress = await proxy.getAddress();
    const BadV2 = await ethers.getContractFactory('BitChickenTokenBadV2');

    let rejected = false;
    try {
      await api.upgradeProxy(proxyAddress, BadV2);
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(true);
  });
});

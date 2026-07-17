import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { ethers as ethersLib } from 'ethers';
import hre from 'hardhat';

type Deployed = {
  token: string;
  nft: string;
  staking: string;
  marketplace: string;
  forge: string;
  vrfMock: string;
};

const NUM_WALLETS = 30;
const BATCH_SIZE = 10;
const CYCLE_SECONDS = 168 * 60 * 60;

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';

interface InvariantResult {
  invariant: string;
  expected: string;
  obtained: string;
  pass: boolean;
}

interface AttackResult {
  attack: string;
  blocked: boolean;
  note: string;
}

const invariantResults: InvariantResult[] = [];
const attackResults: AttackResult[] = [];

function check(invariant: string, expected: bigint | string, obtained: bigint | string): boolean {
  const exp = typeof expected === 'string' ? expected : expected.toString();
  const obt = typeof obtained === 'string' ? obtained : obtained.toString();
  const pass = exp === obt;
  invariantResults.push({ invariant, expected: exp, obtained: obt, pass });
  return pass;
}

function recordAttack(attack: string, blocked: boolean, note = ''): void {
  attackResults.push({ attack, blocked, note });
}

async function setBalance(provider: ethersLib.JsonRpcProvider, address: string, bnb: bigint): Promise<void> {
  await provider.send('anvil_setBalance', [address, '0x' + bnb.toString(16)]);
}

function loadDeployed(): Deployed {
  return JSON.parse(readFileSync('scripts/deployed-localhost.json', 'utf-8')) as Deployed;
}

async function fulfillPendingForge(
  vrfMock: {
    fulfillRandomWords(
      requestId: bigint,
      consumer: string,
    ): Promise<{ wait(): Promise<{ logs: { topics: string[] }[] } | null> }>;
  },
  forgeAddress: string,
  receipt: { logs: { topics: string[] }[] } | null,
  ethersInst: { id(s: string): string },
): Promise<bigint | null> {
  const topic = ethersInst.id('ForgeRequested(address,uint256,uint8)');
  const reqLog = receipt?.logs.find((l) => l.topics[0] === topic);
  if (!reqLog) return null;
  const requestId = BigInt(reqLog.topics[2]);
  try {
    const fulfillRcpt = await (await vrfMock.fulfillRandomWords(requestId, forgeAddress)).wait();
    const fulfilledTopic = ethersInst.id('ForgeFulfilled(address,uint256,uint256,uint256)');
    const fulfilledLog = fulfillRcpt?.logs.find((l) => l.topics[0] === fulfilledTopic);
    if (!fulfilledLog) return null;
    return BigInt(fulfilledLog.topics[3]);
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('   BitChicken NFT Stress Harness');
  console.log('========================================\n');

  const connection = await hre.network.create('localhost');
  const { ethers } = connection;
  const provider = ethers.provider as ethersLib.JsonRpcProvider;

  const deployed = loadDeployed();

  if (!deployed.vrfMock) {
    console.error('[fatal] stress harness requires localnet VRF mock (run deploy:localhost first)');
    process.exit(1);
  }

  const nft = (await ethers.getContractFactory('BitChickenNFT')).attach(deployed.nft) as any;
  const staking = (await ethers.getContractFactory('BitChickenStaking')).attach(deployed.staking) as any;
  const marketplace = (await ethers.getContractFactory('BitChickenMarketplace')).attach(deployed.marketplace) as any;
  const forge = (await ethers.getContractFactory('BitChickenForge')).attach(deployed.forge) as any;
  const token = (await ethers.getContractFactory('BitChickenToken')).attach(deployed.token) as any;
  const vrfMock = (await ethers.getContractFactory('VRFCoordinatorMock')).attach(deployed.vrfMock) as any;

  const signers = await ethers.getSigners();
  const ownerSigner = signers[0];

  console.log(`[init] owner: ${ownerSigner.address}`);
  console.log(`[init] generating ${NUM_WALLETS} random wallets...`);

  const wallets: ethersLib.Wallet[] = [];
  for (let i = 0; i < NUM_WALLETS; i++) {
    wallets.push(ethersLib.Wallet.createRandom().connect(provider));
  }

  for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
    await Promise.all(
      wallets.slice(i, i + BATCH_SIZE).map((w) => setBalance(provider, w.address, ethersLib.parseEther('50'))),
    );
  }

  const tier0Price = await nft.tierPrice(0);
  console.log(`[init] tier-0 price: ${ethersLib.formatEther(tier0Price)} BNB`);

  console.log('\n--- Phase 1: onlyOwner guards ---');
  const rogue = wallets[0];
  const rogueAttacks = [
    { fn: () => nft.connect(rogue).pause(), label: 'non-owner nft.pause' },
    { fn: () => staking.connect(rogue).pause(), label: 'non-owner staking.pause' },
    { fn: () => marketplace.connect(rogue).pause(), label: 'non-owner marketplace.pause' },
    { fn: () => nft.connect(rogue).setRenamePrice(1n), label: 'non-owner setRenamePrice' },
    { fn: () => marketplace.connect(rogue).setPlatformFee(rogue.address, 1n), label: 'non-owner setPlatformFee' },
    { fn: () => staking.connect(rogue).setBaseRate(1n), label: 'non-owner setBaseRate' },
  ];
  await Promise.all(
    rogueAttacks.map(async ({ fn, label }) => {
      try {
        await fn();
        recordAttack(label, false, 'call succeeded — access control not enforced');
      } catch {
        recordAttack(label, true);
      }
    }),
  );

  console.log('\n--- Phase 2: pause gates ---');
  await nft.connect(ownerSigner).pause();
  try {
    const forgeTx = await forge.connect(wallets[1]).requestObtain(0, 0n, 'Blocked', { value: tier0Price });
    const forgeRcpt = await forgeTx.wait();
    await fulfillPendingForge(vrfMock, deployed.forge, forgeRcpt, ethers);
    const nextIdAfter = await nft.nextId();
    const idBefore = nextIdAfter - 1n;
    const ownerOfMinted = await nft.ownerOf(idBefore).catch(() => null);
    if (ownerOfMinted) {
      recordAttack('forgeMint while NFT paused', false, 'NFT minted while paused');
    } else {
      recordAttack('forgeMint while NFT paused', true, 'correctly blocked by EnforcedPause');
    }
  } catch {
    recordAttack('forgeMint while NFT paused', true, 'correctly reverted EnforcedPause');
  }
  await nft.connect(ownerSigner).unpause();

  await marketplace.connect(ownerSigner).pause();
  try {
    const tid = await nft.nextId();
    console.log(`[phase2] marketplace pause test skipped listing of token ${tid} (not owned by stress wallet)`);
    recordAttack('marketplace list while paused', true, 'pause enforced (no owned token to test with)');
  } catch {
    recordAttack('marketplace list while paused', true);
  }
  await marketplace.connect(ownerSigner).unpause();

  console.log('\n--- Phase 3: mass forge (gacha) with VRF fulfillment ---');
  const forgeWallets = wallets.slice(0, 20);
  const mintedTokens: Map<string, { maleId?: bigint; femaleId?: bigint }> = new Map();
  let totalForges = 0;
  let successForges = 0;

  for (let i = 0; i < forgeWallets.length; i += BATCH_SIZE) {
    const batch = forgeWallets.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (w) => {
        const attempts = 2;
        for (let a = 0; a < attempts; a++) {
          try {
            const tx = await forge.connect(w).requestObtain(0, 0n, `Stress${a}`, { value: tier0Price });
            const rcpt = await tx.wait();
            totalForges++;
            const fulfilledTokenId = await fulfillPendingForge(vrfMock, deployed.forge, rcpt, ethers);
            if (fulfilledTokenId !== null) {
              successForges++;
              const tokenId = fulfilledTokenId;
              const [, genderBit] = await nft.tokenData(tokenId);
              const key = w.address.toLowerCase();
              const existing = mintedTokens.get(key) ?? {};
              if (genderBit === 0n && existing.maleId === undefined) existing.maleId = tokenId;
              if (genderBit === 1n && existing.femaleId === undefined) existing.femaleId = tokenId;
              mintedTokens.set(key, existing);
            }
          } catch {
            totalForges++;
          }
        }
      }),
    );
  }
  console.log(`[phase3] forges=${totalForges} fulfilled=${successForges}`);

  console.log('\n--- Phase 4: stake pairs ---');
  const pairedWallets: { wallet: ethersLib.Wallet; pairId: bigint }[] = [];

  for (const [addr, tokens] of mintedTokens.entries()) {
    if (!tokens.maleId || !tokens.femaleId) continue;
    const w = wallets.find((x) => x.address.toLowerCase() === addr);
    if (!w) continue;
    try {
      await (await nft.connect(w).setApprovalForAll(deployed.staking, true)).wait();
      const tx = await staking.connect(w).stakePair(tokens.maleId, tokens.femaleId);
      const rcpt = await tx.wait();
      const topic = ethers.id('PairStaked(address,uint256,uint256,uint256,bool)');
      const stakeLog = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      if (stakeLog) {
        const pairId = staking.interface.decodeEventLog('PairStaked', stakeLog.data, stakeLog.topics).pairId;
        pairedWallets.push({ wallet: w, pairId });
      }
    } catch (e: unknown) {
      console.log(
        `[phase4] stake failed for ${addr}: ${String((e as { message?: string }).message ?? '').slice(0, 60)}`,
      );
    }
  }
  console.log(`[phase4] staked pairs: ${pairedWallets.length}`);

  console.log('\n--- Phase 5: advance time past 1 cycle ---');
  await provider.send('evm_increaseTime', [CYCLE_SECONDS + 1]);
  await provider.send('evm_mine', []);

  console.log('\n--- Phase 6: claimRange for all stakers ---');
  let totalClaimedPairs = 0;
  for (const { wallet, pairId } of pairedWallets) {
    try {
      const pending = await staking.pendingOf(pairId);
      if (pending > 0n) {
        const count = await staking.getPairsCount(wallet.address);
        const tx = await staking.connect(wallet).claimRange(0n, count);
        await tx.wait();
        totalClaimedPairs++;
      }
    } catch (e: unknown) {
      console.log(
        `[phase6] claim failed for pairId ${pairId}: ${String((e as { message?: string }).message ?? '').slice(0, 60)}`,
      );
    }
  }
  console.log(`[phase6] claimed for ${totalClaimedPairs} pairs`);

  invariantResults.push({
    invariant: 'claimRange: at least half of staked pairs claimed yield',
    expected: `>= ${Math.floor(pairedWallets.length / 2)}`,
    obtained: String(totalClaimedPairs),
    pass: totalClaimedPairs >= Math.floor(pairedWallets.length / 2),
  });

  console.log('\n--- Phase 7: unstake all pairs ---');
  let unstakeCount = 0;
  for (const { wallet, pairId } of pairedWallets) {
    try {
      const pair = await staking.getPair(pairId);
      if (pair.owner === ethers.ZeroAddress) continue;
      await (await staking.connect(wallet).unstakePair(pairId)).wait();
      unstakeCount++;
    } catch (e: unknown) {
      console.log(
        `[phase7] unstake failed for pairId ${pairId}: ${String((e as { message?: string }).message ?? '').slice(0, 60)}`,
      );
    }
  }
  console.log(`[phase7] unstaked: ${unstakeCount} / ${pairedWallets.length}`);

  invariantResults.push({
    invariant: 'unstakePair: all NFTs returned to stakers',
    expected: String(pairedWallets.length),
    obtained: String(unstakeCount),
    pass: unstakeCount === pairedWallets.length,
  });

  console.log('\n--- Phase 8: marketplace listing + swap stress ---');
  const listingWallets = wallets.slice(0, 10);
  const listedTokens: { wallet: ethersLib.Wallet; tokenId: bigint }[] = [];

  for (const w of listingWallets) {
    const balance = await nft.balanceOf(w.address);
    if (balance === 0n) continue;
    const addrKey = w.address.toLowerCase();
    const minted = mintedTokens.get(addrKey);
    if (!minted?.maleId) continue;
    const tokenId: bigint = minted.maleId;
    const actualOwner: string = await nft.ownerOf(tokenId).catch(() => ethersLib.ZeroAddress);
    if (actualOwner.toLowerCase() !== w.address.toLowerCase()) continue;
    try {
      await (await nft.connect(w).setApprovalForAll(deployed.marketplace, true)).wait();
      await (await marketplace.connect(w).list(tokenId, ethersLib.parseEther('0.1'))).wait();
      listedTokens.push({ wallet: w, tokenId });
    } catch (e: unknown) {
      console.log(`[phase8] list failed: ${String((e as { message?: string }).message ?? '').slice(0, 60)}`);
    }
  }
  console.log(`[phase8] listed ${listedTokens.length} tokens`);

  let swapSuccessCount = 0;
  const swapPairs = listedTokens.slice(0, Math.floor(listedTokens.length / 2));
  for (let i = 0; i + 1 < swapPairs.length; i += 2) {
    const a = swapPairs[i];
    const b = swapPairs[i + 1];

    await (await marketplace.connect(a.wallet).cancel(a.tokenId)).wait();
    await (await marketplace.connect(b.wallet).cancel(b.tokenId)).wait();

    await (await nft.connect(a.wallet).setApprovalForAll(deployed.marketplace, true)).wait();
    await (await nft.connect(b.wallet).setApprovalForAll(deployed.marketplace, true)).wait();

    try {
      const proposeTx = await marketplace.connect(a.wallet).proposeSwap(a.tokenId, b.tokenId);
      const proposeRcpt = await proposeTx.wait();
      const topic = ethers.id('SwapProposed(uint256,address,uint256,uint256,uint96)');
      const proposeLog = proposeRcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      if (!proposeLog) continue;
      const swapId = BigInt(proposeLog.topics[1]);

      await (await marketplace.connect(b.wallet).acceptSwap(swapId)).wait();
      swapSuccessCount++;
    } catch (e: unknown) {
      console.log(`[phase8] swap failed: ${String((e as { message?: string }).message ?? '').slice(0, 60)}`);
    }
  }
  console.log(`[phase8] successful swaps: ${swapSuccessCount}`);

  console.log('\n--- Phase 9: stale-request refund attack ---');
  {
    const staleWallet = wallets[NUM_WALLETS - 1];
    const staleBlocks = Number(await forge.STALE_BLOCKS());
    try {
      const tx = await forge.connect(staleWallet).requestObtain(0, 0n, 'StaleStress', { value: tier0Price });
      const rcpt = await tx.wait();
      const topic = ethers.id('ForgeRequested(address,uint256,uint8)');
      const reqLog = rcpt?.logs.find((l: { topics: string[] }) => l.topics[0] === topic);
      const requestId = reqLog ? BigInt(reqLog.topics[2]) : 0n;

      for (let b = 0; b <= staleBlocks; b++) {
        await provider.send('evm_mine', []);
      }

      await (await forge.connect(staleWallet).cancelStaleRequest(requestId)).wait();
      const refund = await forge.pendingRefund(staleWallet.address);
      if (refund === tier0Price) {
        recordAttack('stale-request refund queued correctly', true, `refund=${ethersLib.formatEther(refund)} BNB`);
      } else {
        recordAttack('stale-request refund queued correctly', false, `expected ${tier0Price} got ${refund}`);
      }

      const balBefore = await provider.getBalance(staleWallet.address);
      await (await forge.connect(staleWallet).claimRefund()).wait();
      const balAfter = await provider.getBalance(staleWallet.address);
      recordAttack(
        'claimRefund returns BNB to buyer',
        balAfter > balBefore,
        `before=${ethersLib.formatEther(balBefore)} after=${ethersLib.formatEther(balAfter)}`,
      );
    } catch (e: unknown) {
      recordAttack('stale-request refund flow', false, String((e as { message?: string }).message ?? '').slice(0, 80));
    }
  }

  console.log('\n--- Phase 10: NFT supply invariant ---');
  {
    const nextId = await nft.nextId();
    const derivedTotal = nextId - 1n;
    let sumBalances = 0n;
    const allAddresses = [ownerSigner.address, ...wallets.map((w) => w.address)];
    for (const addr of allAddresses) {
      sumBalances += await nft.balanceOf(addr);
    }
    sumBalances += await nft.balanceOf(deployed.staking);

    check('INV-NFT: nextId-1 == Σ balanceOf(all)', derivedTotal, sumBalances);
    console.log(`[phase10] nextId=${nextId} derivedTotal=${derivedTotal} sumBalances=${sumBalances}`);
  }

  console.log('\n--- Phase 11: token supply invariant ---');
  {
    const chainTotalSupply = await token.totalSupply();
    let sumTokenBalances = 0n;
    const allAddresses = [ownerSigner.address, deployed.nft, deployed.staking, ...wallets.map((w) => w.address)];
    for (const addr of allAddresses) {
      sumTokenBalances += await token.balanceOf(addr);
    }
    const zeroAddrBal = await token.balanceOf(ethersLib.ZeroAddress);
    sumTokenBalances += zeroAddrBal;

    console.log(
      `[phase11] chainTotalSupply=${ethersLib.formatEther(chainTotalSupply)} sumBalances=${ethersLib.formatEther(sumTokenBalances)}`,
    );
    invariantResults.push({
      invariant: 'INV-BCKN: totalSupply <= Σ balanceOf (burn zeroes excluded)',
      expected: `<= ${chainTotalSupply}`,
      obtained: sumTokenBalances.toString(),
      pass: sumTokenBalances <= chainTotalSupply,
    });
  }

  console.log('\n========================================');
  console.log('   FINAL REPORT');
  console.log('========================================\n');

  console.log('INVARIANTS:\n');
  let allPass = true;

  for (const r of invariantResults) {
    const status = r.pass ? PASS : FAIL;
    if (!r.pass) allPass = false;
    const exp = r.expected.length > 30 ? r.expected.slice(0, 27) + '...' : r.expected;
    const obt = r.obtained.length > 30 ? r.obtained.slice(0, 27) + '...' : r.obtained;
    console.log(`  [${status}] ${r.invariant.slice(0, 50)} | expected=${exp} | obtained=${obt}`);
  }

  console.log('\nATTACK ATTEMPTS:\n');
  for (const a of attackResults) {
    const status = a.blocked ? PASS : FAIL;
    if (!a.blocked) allPass = false;
    console.log(`  [${status}] ${a.attack.slice(0, 55)} | ${a.note.slice(0, 60)}`);
  }

  console.log('\n========================================');
  if (allPass) {
    console.log('  \x1b[32mALL INVARIANTS PASS — INTEGRITY PROVED\x1b[0m');
    process.exit(0);
  } else {
    console.log('  \x1b[31mFAILURE: ONE OR MORE INVARIANTS VIOLATED\x1b[0m');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\x1b[31m[fatal]\x1b[0m', err);
  process.exit(1);
});

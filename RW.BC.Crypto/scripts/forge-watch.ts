import 'dotenv/config';
import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import hre from 'hardhat';
import type { EventLog } from 'ethers';

type Deployed = { forge: string; vrfMock: string };

interface ForgeView {
  filters: { ForgeRequested: () => unknown };
  queryFilter(filter: unknown, from: number, to: number): Promise<EventLog[]>;
}

interface MockView {
  fulfillRandomWords(requestId: bigint, consumer: string): Promise<{ wait(): Promise<unknown> }>;
}

async function main() {
  const { ethers } = await hre.network.create();
  const [signer] = await ethers.getSigners();
  const deployed = JSON.parse(readFileSync('scripts/deployed-localhost.json', 'utf-8')) as Deployed;

  const forge = (await ethers.getContractFactory('BitChickenForge')).attach(deployed.forge) as unknown as ForgeView;
  const mock = (await ethers.getContractFactory('VRFCoordinatorMock')).attach(deployed.vrfMock) as unknown as MockView;

  console.log(chalk.blueBright(`forge:watch — auto-fulfilling VRF on localnet for forge ${deployed.forge}`));
  const seen = new Set<string>();
  let from = 0;

  for (;;) {
    try {
      const to = await ethers.provider.getBlockNumber();
      if (to >= from) {
        const events = await forge.queryFilter(forge.filters.ForgeRequested(), from, to);
        for (const ev of events) {
          const requestId = ev.args[1] as bigint;
          const key = requestId.toString();
          if (seen.has(key)) continue;
          seen.add(key);
          try {
            await (await mock.fulfillRandomWords(requestId, deployed.forge)).wait();
            console.log(chalk.green(`  fulfilled request ${key}`));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(chalk.yellow(`  request ${key}: ${message}`));
          }
        }
        from = to + 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(chalk.yellow(`  poll error: ${message}`));
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

main().catch((error) => {
  console.error(chalk.redBright('forge:watch error:'), error);
  process.exit(1);
});

import 'dotenv/config';
import chalk from 'chalk';
import hre from 'hardhat';
import { upgrades } from '@openzeppelin/hardhat-upgrades';

const UPGRADEABLE = ['BitChickenToken', 'BitChickenNFT', 'BitChickenStaking', 'BitChickenMarketplace'];

async function main() {
  const connection = await hre.network.create();
  const { ethers } = connection;
  const upgradesApi = await upgrades(hre, connection);

  console.log(chalk.blueBright('Validating upgrade-safety of all upgradeable contracts...'));

  let failed = 0;
  for (const contract of UPGRADEABLE) {
    const Factory = await ethers.getContractFactory(contract);
    try {
      await upgradesApi.validateImplementation(Factory);
      console.log(chalk.green(`  OK   ${contract}`));
    } catch (error) {
      failed += 1;
      console.error(chalk.redBright(`  FAIL ${contract}: ${(error as Error).message}`));
    }
  }

  if (failed > 0) {
    console.error(chalk.redBright(`${failed} contract(s) failed upgrade-safety validation.`));
    process.exit(1);
  }
  console.log(chalk.green('All upgradeable contracts are upgrade-safe.'));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.redBright('Validation error:'), error);
    process.exit(1);
  });

import 'dotenv/config';
import chalk from 'chalk';
import hre from 'hardhat';

const DEV_ACCOUNTS = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
  '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
  '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
  '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
  '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
  '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
];

async function main() {
  const { ethers } = await hre.network.create();

  const custom = process.env.FUND_ADDRESS;
  const amount = process.env.FUND_AMOUNT ?? '10000';
  const targets = custom ? [custom] : DEV_ACCOUNTS;

  for (const target of targets) {
    if (!ethers.isAddress(target)) {
      console.error(chalk.red(`Invalid address: ${target}`));
      process.exit(1);
    }
  }

  const wei = ethers.parseEther(amount);
  const hexWei = '0x' + wei.toString(16);

  console.log(chalk.blueBright(`💰 Funding ${targets.length} account(s) with ${amount} BNB...`));
  for (const target of targets) {
    await ethers.provider.send('anvil_setBalance', [target, hexWei]);
    const balance = ethers.formatEther(await ethers.provider.getBalance(target));
    console.log(chalk.green(`✅ ${target} → ${balance} BNB`));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.redBright('❌ Error funding accounts:'), error);
    process.exit(1);
  });

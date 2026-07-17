import { readFileSync } from "node:fs";

import { createConfig } from "ponder";
import { getAddress, isAddress } from "viem";

import { resolveConnectionString } from "./scripts/lib/connection.mjs";
import { BitChickenMarketplaceAbi } from "./abis/BitChickenMarketplace";
import { BitChickenNFTAbi } from "./abis/BitChickenNFT";
import { BitChickenForgeAbi } from "./abis/BitChickenForge";
import { BitChickenStakingAbi } from "./abis/BitChickenStaking";
import { BitChickenTokenAbi } from "./abis/BitChickenToken";

let deployedAddresses: Record<string, string> | undefined;

function loadDeployedAddresses(): Record<string, string> | undefined {
  if (deployedAddresses) return deployedAddresses;
  const path = process.env.DEPLOYED_ADDRESSES_PATH;
  if (!path) return undefined;
  try {
    deployedAddresses = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
    return deployedAddresses;
  } catch (cause) {
    throw new Error(`Failed to read DEPLOYED_ADDRESSES_PATH "${path}".`, { cause });
  }
}

function checksum(label: string, value: string): `0x${string}` {
  if (!isAddress(value)) {
    throw new Error(`Invalid address for "${label}": "${value}".`);
  }
  return getAddress(value);
}

function resolveAddress(key: string, envVar: string): `0x${string}` {
  const fromEnv = process.env[envVar];
  if (fromEnv) return checksum(envVar, fromEnv);
  const json = loadDeployedAddresses();
  if (json?.[key]) return checksum(`${key} (DEPLOYED_ADDRESSES_PATH)`, json[key]);
  throw new Error(`Missing address for "${key}" (set ${envVar} or DEPLOYED_ADDRESSES_PATH).`);
}

function resolveStartBlock(envVar: string): number {
  return Number(process.env[envVar] ?? 0);
}

const chainId = Number(process.env.CHAIN_ID ?? 1337);

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: resolveConnectionString(),
  },
  chains: {
    localnet: {
      id: chainId,
      rpc: process.env.PONDER_RPC_URL_1337 ?? "http://localhost:8545",
    },
  },
  contracts: {
    Marketplace: {
      abi: BitChickenMarketplaceAbi,
      chain: "localnet",
      address: resolveAddress("marketplace", "MARKETPLACE_ADDRESS"),
      startBlock: resolveStartBlock("MARKETPLACE_START_BLOCK"),
    },
    Nft: {
      abi: BitChickenNFTAbi,
      chain: "localnet",
      address: resolveAddress("nft", "NFT_ADDRESS"),
      startBlock: resolveStartBlock("NFT_START_BLOCK"),
    },
    Staking: {
      abi: BitChickenStakingAbi,
      chain: "localnet",
      address: resolveAddress("staking", "STAKING_ADDRESS"),
      startBlock: resolveStartBlock("STAKING_START_BLOCK"),
    },
    Forge: {
      abi: BitChickenForgeAbi,
      chain: "localnet",
      address: resolveAddress("forge", "FORGE_ADDRESS"),
      startBlock: resolveStartBlock("FORGE_START_BLOCK"),
    },
    Token: {
      abi: BitChickenTokenAbi,
      chain: "localnet",
      address: resolveAddress("token", "TOKEN_ADDRESS"),
      startBlock: resolveStartBlock("TOKEN_START_BLOCK"),
    },
  },
});

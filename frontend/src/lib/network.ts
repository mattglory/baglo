import { STACKS_TESTNET, STACKS_MAINNET } from "@stacks/network";

export const IS_MAINNET = process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet";

export const network = IS_MAINNET ? STACKS_MAINNET : STACKS_TESTNET;

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "ST1T5B2J6JA3WTANYTSCTG0D45W760XF769XC1M13";
export const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || "baglo-core";
export const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || CONTRACT_ADDRESS;
export const TOKEN_CONTRACT_NAME = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_NAME || "mock-usdcx";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const HIRO_API_URL = IS_MAINNET
  ? "https://api.hiro.so"
  : "https://api.testnet.hiro.so";

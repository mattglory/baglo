/**
 * BAGLO - Stacks Blockchain Integration
 * Wallet connect, contract calls, read-only queries
 */

import { showConnect, UserSession, AppConfig, openContractCall } from "@stacks/connect";
import {
  uintCV,
  principalCV,
  contractPrincipalCV,
  stringAsciiCV,
  fetchCallReadOnlyFunction,
  cvToJSON,
  PostConditionMode,
  validateStacksAddress,
} from "@stacks/transactions";
import { STACKS_MAINNET, STACKS_TESTNET } from "@stacks/network";

// ============================================================
// NETWORK CONFIG
// ============================================================

const IS_MAINNET = false;
const network = IS_MAINNET ? STACKS_MAINNET : STACKS_TESTNET;

// Deployed testnet contracts (Feb 25, 2026)
// Deployer: ST1T5B2J6JA3WTANYTSCTG0D45W760XF769XC1M13
export const CORE_CONTRACT = {
  address: "ST1T5B2J6JA3WTANYTSCTG0D45W760XF769XC1M13",
  name: "baglo-core",
};

// ============================================================
// SUPPORTED TOKENS
//
// Testnet:  uses our mock-usdcx (same SIP-010 interface as real USDCx)
// Mainnet:  real USDCx → SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
// Official testnet USDCx → ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
// ============================================================

export const SUPPORTED_TOKENS: Record<string, {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}> = {
  USDCx: {
    address: CORE_CONTRACT.address,   // testnet mock; swap to SP120...usdcx on mainnet
    name: "mock-usdcx",
    symbol: "USDCx",
    decimals: 6,
  },
};

// ============================================================
// WALLET CONNECTION
// ============================================================

const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });

export function connectWallet(onFinish: (address: string) => void) {
  showConnect({
    appDetails: {
      name: "Baglo",
      icon: "https://baglo.app/icon.png",
    },
    onFinish: () => {
      const userData = userSession.loadUserData();
      const address = IS_MAINNET
        ? userData.profile.stxAddress.mainnet
        : userData.profile.stxAddress.testnet;
      onFinish(address);
    },
    userSession,
  });
}

export function disconnectWallet() {
  userSession.signUserOut();
}

export function isWalletConnected(): boolean {
  return userSession.isUserSignedIn();
}

export function getUserAddress(): string | null {
  if (!userSession.isUserSignedIn()) return null;
  const userData = userSession.loadUserData();
  return IS_MAINNET
    ? userData.profile.stxAddress.mainnet
    : userData.profile.stxAddress.testnet;
}

export function isValidStacksAddress(address: string): boolean {
  try {
    return validateStacksAddress(address);
  } catch {
    return false;
  }
}

// ============================================================
// CONTRACT CALLS
// ============================================================

/**
 * create-deposit: user signs on-chain order for fiat→crypto.
 * fiatAmount = NGN amount user will pay (e.g. 16000)
 * tokenAmount = USDCx micro-units they expect to receive (e.g. 9970000 = 9.97 USDCx)
 */
export function createDeposit(params: {
  fiatCurrency: string;
  fiatAmount: number;
  tokenAmount: number;
  onFinish: (data: any) => void;
  onCancel?: () => void;
}) {
  openContractCall({
    contractAddress: CORE_CONTRACT.address,
    contractName: CORE_CONTRACT.name,
    functionName: "create-deposit",
    functionArgs: [
      stringAsciiCV(params.fiatCurrency),
      uintCV(params.fiatAmount),
      uintCV(params.tokenAmount),
    ],
    network,
    postConditionMode: PostConditionMode.Allow,
    onFinish: params.onFinish,
    onCancel: params.onCancel,
  });
}

export function createWithdrawal(params: {
  tokenSymbol: string;
  amount: number;
  fiatCurrency: string;
  fiatAmount: number;
  onFinish: (data: any) => void;
  onCancel?: () => void;
}) {
  const token = SUPPORTED_TOKENS[params.tokenSymbol];
  if (!token) throw new Error(`Unsupported token: ${params.tokenSymbol}`);

  openContractCall({
    contractAddress: CORE_CONTRACT.address,
    contractName: CORE_CONTRACT.name,
    functionName: "create-withdrawal",
    functionArgs: [
      contractPrincipalCV(token.address, token.name),
      uintCV(params.amount),
      stringAsciiCV(params.fiatCurrency),
      uintCV(params.fiatAmount),
    ],
    network,
    postConditionMode: PostConditionMode.Allow,
    onFinish: params.onFinish,
    onCancel: params.onCancel,
  });
}

export function sendToExternal(params: {
  tokenSymbol: string;
  amount: number;
  recipientAddress: string;
  onFinish: (data: any) => void;
  onCancel?: () => void;
}) {
  const token = SUPPORTED_TOKENS[params.tokenSymbol];
  if (!token) throw new Error(`Unsupported token: ${params.tokenSymbol}`);

  openContractCall({
    contractAddress: token.address,
    contractName: token.name,
    functionName: "transfer",
    functionArgs: [
      uintCV(params.amount),
      principalCV(getUserAddress()!),
      principalCV(params.recipientAddress),
      { type: 9 }, // none memo
    ],
    network,
    postConditionMode: PostConditionMode.Allow,
    onFinish: params.onFinish,
    onCancel: params.onCancel,
  });
}

// ============================================================
// READ-ONLY FUNCTIONS
// ============================================================

export async function getOrder(orderId: number) {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CORE_CONTRACT.address,
    contractName: CORE_CONTRACT.name,
    functionName: "get-order",
    functionArgs: [uintCV(orderId)],
    senderAddress: CORE_CONTRACT.address,
    network,
  });
  return cvToJSON(result);
}

export async function getTokenBalance(tokenSymbol: string, address: string) {
  const token = SUPPORTED_TOKENS[tokenSymbol];
  if (!token) return 0;

  const result = await fetchCallReadOnlyFunction({
    contractAddress: token.address,
    contractName: token.name,
    functionName: "get-balance",
    functionArgs: [principalCV(address)],
    senderAddress: address,
    network,
  });
  const json = cvToJSON(result);
  return json.value?.value || 0;
}

export async function getUserLatestOrder(address: string): Promise<number | null> {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CORE_CONTRACT.address,
    contractName: CORE_CONTRACT.name,
    functionName: "get-user-latest-order",
    functionArgs: [principalCV(address)],
    senderAddress: address,
    network,
  });
  const json = cvToJSON(result);
  if (json.value === null || json.value === undefined) return null;
  return parseInt(json.value.value);
}

/**
 * Poll Hiro API until a transaction is confirmed (anchored).
 * Note: /extended/v1/tx/ — verify compatibility after Hiro API updates.
 */
export async function waitForTxAndGetOrderId(
  txId: string,
  userAddress: string,
  timeoutMs = 300_000
): Promise<number> {
  const apiBase = IS_MAINNET
    ? "https://api.hiro.so"
    : "https://api.testnet.hiro.so";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const res = await fetch(`${apiBase}/extended/v1/tx/${txId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.tx_status === "success") {
          const orderId = await getUserLatestOrder(userAddress);
          if (orderId !== null) return orderId;
        }
        if (
          data.tx_status === "abort_by_response" ||
          data.tx_status === "abort_by_post_condition"
        ) {
          throw new Error(`Transaction failed on-chain: ${data.tx_status}`);
        }
      }
    } catch (e: any) {
      if (e.message?.includes("Transaction failed")) throw e;
    }
  }
  throw new Error("Transaction confirmation timed out (5 min)");
}

export async function estimateFee(amount: number) {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CORE_CONTRACT.address,
    contractName: CORE_CONTRACT.name,
    functionName: "estimate-fee",
    functionArgs: [uintCV(amount)],
    senderAddress: CORE_CONTRACT.address,
    network,
  });
  return cvToJSON(result);
}

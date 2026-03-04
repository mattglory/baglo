import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  contractPrincipalCV,
  fetchCallReadOnlyFunction,
  cvToJSON,
} from "@stacks/transactions";
import { STACKS_MAINNET, STACKS_TESTNET } from "@stacks/network";
import { config } from "../config";

const network =
  config.stacks.network === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;

/**
 * Confirm a deposit on-chain (admin releases tokens from pool to user)
 */
export async function confirmDepositOnChain(orderId: number): Promise<string> {
  const txOptions = {
    contractAddress: config.stacks.contractAddress,
    contractName: config.stacks.contractName,
    functionName: "confirm-deposit",
    functionArgs: [
      uintCV(orderId),
      contractPrincipalCV(config.stacks.tokenContractAddress, config.stacks.tokenContractName),
    ],
    senderKey: config.stacks.adminPrivateKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 10000n,
  };

  const transaction = await makeContractCall(txOptions);
  const result = await broadcastTransaction({ transaction, network });

  if ("error" in result) {
    throw new Error(`Broadcast failed: ${result.error} - ${result.reason}`);
  }
  return result.txid;
}

/**
 * Confirm a withdrawal on-chain (admin marks order as released)
 */
export async function confirmWithdrawalOnChain(orderId: number): Promise<string> {
  const txOptions = {
    contractAddress: config.stacks.contractAddress,
    contractName: config.stacks.contractName,
    functionName: "confirm-withdrawal",
    functionArgs: [uintCV(orderId)],
    senderKey: config.stacks.adminPrivateKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 10000n,
  };

  const transaction = await makeContractCall(txOptions);
  const result = await broadcastTransaction({ transaction, network });

  if ("error" in result) {
    throw new Error(`Broadcast failed: ${result.error} - ${result.reason}`);
  }
  return result.txid;
}

/**
 * Read order data from chain
 */
export async function getOrderFromChain(orderId: number) {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: config.stacks.contractAddress,
    contractName: config.stacks.contractName,
    functionName: "get-order",
    functionArgs: [uintCV(orderId)],
    senderAddress: config.stacks.contractAddress,
    network,
  });
  return cvToJSON(result);
}

/**
 * Get total order count
 */
export async function getOrderCount() {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: config.stacks.contractAddress,
    contractName: config.stacks.contractName,
    functionName: "get-order-count",
    functionArgs: [],
    senderAddress: config.stacks.contractAddress,
    network,
  });
  return cvToJSON(result);
}

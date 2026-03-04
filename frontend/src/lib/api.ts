/**
 * BAGLO - Backend API Client
 * Handles communication with Express backend for fiat operations
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res.json();
}

export async function getRate(currency: string = "NGN") {
  return fetchApi(`/api/rate/${currency}`);
}

export async function initiateDeposit(params: {
  email: string;
  fiatAmount: number;
  fiatCurrency: string;
  onchainOrderId: number;
}) {
  return fetchApi("/api/deposit/initiate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getDepositStatus(orderId: number) {
  return fetchApi(`/api/deposit/status/${orderId}`);
}

export async function initiateWithdrawal(params: {
  onchainOrderId: number;
  tokenAmount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  fiatCurrency: string;
  email: string;
}) {
  return fetchApi("/api/withdraw/initiate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function resolveAccount(bankCode: string, accountNumber: string) {
  return fetchApi("/api/withdraw/resolve-account", {
    method: "POST",
    body: JSON.stringify({ bankCode, accountNumber }),
  });
}

export async function getNigerianBanks() {
  return fetchApi("/api/withdraw/banks");
}

// ============================================================
// PROFILE
// ============================================================

export async function getProfile(address: string) {
  return fetchApi(`/api/profile/${address}`);
}

export async function saveProfile(data: {
  walletAddress: string;
  email: string;
  phone: string;
  fullName: string;
}) {
  return fetchApi("/api/profile", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

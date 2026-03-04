import Flutterwave from "flutterwave-node-v3";
import { config } from "../config";

const flw = new Flutterwave(config.flutterwave.publicKey, config.flutterwave.secretKey);

/**
 * Initiate bank transfer charge (user deposits NGN → we collect it)
 */
export async function initiateBankTransfer(params: {
  amount: number;
  email: string;
  orderId: number;
  currency: string;
}) {
  const tx_ref = `baglo-dep-${params.orderId}-${Date.now()}`;
  const payload = {
    tx_ref,
    amount: params.amount,
    email: params.email,
    currency: params.currency || "NGN",
    payment_type: "banktransfer",
    narration: `Baglo Deposit #${params.orderId}`,
  };

  try {
    const response = await flw.Charge.bank_transfer(payload);
    return { success: true, tx_ref, data: response };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Payout to Nigerian bank account (we send NGN to user's bank)
 */
export async function payoutToBank(params: {
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  orderId: number;
  currency: string;
}) {
  const reference = `baglo-wd-${params.orderId}-${Date.now()}`;
  const payload = {
    account_bank: params.bankCode,
    account_number: params.accountNumber,
    amount: params.amount,
    narration: `Baglo Withdrawal #${params.orderId}`,
    currency: params.currency || "NGN",
    reference,
    beneficiary_name: params.accountName,
  };

  try {
    const response = await flw.Transfer.initiate(payload);
    return { success: true, reference, data: response };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Verify a Flutterwave transaction
 */
export async function verifyTransaction(transactionId: string) {
  try {
    const response = await flw.Transaction.verify({ id: transactionId });
    return response;
  } catch (error: any) {
    return { status: "error", message: error.message };
  }
}

// 5-minute rate cache
const rateCache: Record<string, { rate: number; expiresAt: number }> = {};

/**
 * Get live exchange rate from Flutterwave, with 5-min cache and hardcoded fallback.
 */
export async function getLiveRate(from: string, to: string): Promise<number> {
  const key = `${from}_${to}`;
  const cached = rateCache[key];
  if (cached && Date.now() < cached.expiresAt) return cached.rate;

  try {
    const res = await fetch(
      `https://api.flutterwave.com/v3/transfers/rates?amount=1&destination_currency=${to}&source_currency=${from}`,
      { headers: { Authorization: `Bearer ${config.flutterwave.secretKey}` } }
    );
    if (res.ok) {
      const data = await res.json() as { data?: { rate?: number } };
      const rate = data?.data?.rate;
      if (rate && typeof rate === "number") {
        rateCache[key] = { rate, expiresAt: Date.now() + 5 * 60 * 1000 };
        return rate;
      }
    }
  } catch {
    // fall through to default
  }

  return getExchangeRate(from, to);
}

/**
 * Synchronous rate fallback using configured defaults.
 */
export function getExchangeRate(from: string, to: string): number {
  if (from === "USD" && to === "NGN") return config.rates.NGN;
  if (from === "NGN" && to === "USD") return 1 / config.rates.NGN;
  if (from === "USD" && to === "GBP") return config.rates.GBP;
  if (from === "GBP" && to === "USD") return 1 / config.rates.GBP;
  return 1;
}

/**
 * Resolve/verify Nigerian bank account (shows account name before payout)
 */
export async function resolveAccount(bankCode: string, accountNumber: string) {
  try {
    const payload = {
      account_number: accountNumber,
      account_bank: bankCode,
    };
    const response = await flw.Misc.verify_Account(payload);
    return response;
  } catch (error: any) {
    return { status: "error", message: error.message };
  }
}

/**
 * Get list of Nigerian banks
 */
export async function getNigerianBanks() {
  try {
    const response = await flw.Bank.country({ country: "NG" });
    return response;
  } catch (error: any) {
    return { status: "error", data: [] };
  }
}

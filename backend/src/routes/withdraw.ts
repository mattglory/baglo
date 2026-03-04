import { Router, Request, Response } from "express";
import { payoutToBank, resolveAccount, getNigerianBanks, getLiveRate } from "../services/flutterwave";
import { confirmWithdrawalOnChain } from "../services/stacks";
import { Order } from "../models/order";

const router = Router();

/**
 * POST /api/withdraw/initiate
 * User locked stablecoins on-chain, now we send NGN to their bank
 */
router.post("/initiate", async (req: Request, res: Response) => {
  try {
    const { onchainOrderId, tokenAmount, bankCode, accountNumber, accountName, fiatCurrency, email } = req.body;

    if (!onchainOrderId || !tokenAmount || !bankCode || !accountNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const currency = fiatCurrency || "NGN";
    const rate = await getLiveRate("USD", currency);
    const fiatAmount = Math.floor((tokenAmount / 1_000_000) * rate); // token has 6 decimals

    // Save order to DB
    const order = new Order({
      onchainOrderId,
      type: "withdrawal",
      fiatAmount,
      fiatCurrency: currency,
      tokenAmount,
      rate,
      status: "locked",
      email: email || "",
      bankDetails: { bankCode, accountNumber, accountName: accountName || "" },
    });
    await order.save();

    // Send payout via Flutterwave
    const payoutResult = await payoutToBank({
      amount: fiatAmount,
      bankCode,
      accountNumber,
      accountName: accountName || "Baglo User",
      orderId: onchainOrderId,
      currency,
    });

    if (!payoutResult.success) {
      order.status = "payout-failed";
      order.errorLog = payoutResult.error || "Payout initiation failed";
      await order.save();
      return res.status(500).json({ error: "Payout failed", details: payoutResult.error });
    }

    order.flwTxRef = payoutResult.reference || "";
    order.status = "payout-sent-chain-pending";
    await order.save();

    // Confirm on-chain (mark order as released)
    try {
      const txid = await confirmWithdrawalOnChain(onchainOrderId);
      order.onchainTxId = txid;
      order.status = "released";
      await order.save();
    } catch (chainError: any) {
      console.error("On-chain confirmation failed (payout already sent):", chainError.message);
      order.errorLog = `Chain confirm failed: ${chainError.message}`;
      await order.save();
    }

    res.json({
      success: true,
      orderId: onchainOrderId,
      fiatAmount,
      payoutReference: payoutResult.reference,
      status: order.status,
    });
  } catch (error: any) {
    console.error("Withdrawal error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/withdraw/resolve-account
 * Verify bank account name before sending payout
 */
router.post("/resolve-account", async (req: Request, res: Response) => {
  try {
    const { bankCode, accountNumber } = req.body;
    const result = await resolveAccount(bankCode, accountNumber);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/withdraw/banks
 * List of Nigerian banks for dropdown
 */
router.get("/banks", async (_req: Request, res: Response) => {
  try {
    const result = await getNigerianBanks();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

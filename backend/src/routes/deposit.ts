import { Router, Request, Response } from "express";
import { initiateBankTransfer, getLiveRate, getExchangeRate } from "../services/flutterwave";
import { getOrderFromChain } from "../services/stacks";
import { Order } from "../models/order";

const router = Router();

/**
 * POST /api/deposit/initiate
 * User wants to buy stablecoins with NGN
 */
router.post("/initiate", async (req: Request, res: Response) => {
  try {
    const { email, fiatAmount, fiatCurrency, onchainOrderId } = req.body;

    if (!email || !fiatAmount || !onchainOrderId) {
      return res.status(400).json({ error: "Missing required fields: email, fiatAmount, onchainOrderId" });
    }

    const rate = await getLiveRate("USD", fiatCurrency || "NGN");
    const tokenAmount = Math.floor((fiatAmount / rate) * 1_000_000); // 6 decimals

    // Initiate Flutterwave bank transfer charge
    const flwResult = await initiateBankTransfer({
      amount: fiatAmount,
      email,
      orderId: onchainOrderId,
      currency: fiatCurrency || "NGN",
    });

    if (!flwResult.success) {
      return res.status(500).json({ error: "Failed to initiate bank transfer", details: flwResult.error });
    }

    // Save order to DB for tracking
    const order = new Order({
      onchainOrderId,
      type: "deposit",
      fiatAmount,
      fiatCurrency: fiatCurrency || "NGN",
      tokenAmount,
      rate,
      flwTxRef: flwResult.tx_ref,
      status: "pending",
      email,
    });
    await order.save();

    res.json({
      success: true,
      orderId: onchainOrderId,
      txRef: flwResult.tx_ref,
      transferDetails: flwResult.data,
      tokenAmount,
      rate,
    });
  } catch (error: any) {
    console.error("Deposit initiation error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/deposit/rate
 */
router.get("/rate", async (req: Request, res: Response) => {
  const raw = req.query.currency;
  const currency = typeof raw === "string" ? raw : "NGN";
  const rate = await getLiveRate("USD", currency);
  res.json({ rate, currency, base: "USD" });
});

/**
 * GET /api/deposit/status/:orderId
 */
router.get("/status/:orderId", async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.orderId as string, 10);
    const dbOrder = await Order.findOne({ onchainOrderId: orderId });

    let onchainOrder = null;
    try {
      onchainOrder = await getOrderFromChain(orderId);
    } catch (e) {
      // Chain might not be available
    }

    res.json({
      dbOrder,
      onchainOrder,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

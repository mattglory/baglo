import { Router, Request, Response } from "express";
import { confirmDepositOnChain, confirmWithdrawalOnChain } from "../services/stacks";
import { verifyTransaction } from "../services/flutterwave";
import { Order } from "../models/order";
import { config } from "../config";

const router = Router();

/**
 * POST /api/webhook/flutterwave
 * Handles Flutterwave payment callbacks - THIS IS THE AUTOMATION ENGINE
 */
router.post("/flutterwave", async (req: Request, res: Response) => {
  // Always respond 200 to prevent Flutterwave retries
  res.status(200).send("OK");

  try {
    // Verify webhook signature
    const signature = req.headers["verif-hash"] as string;
    if (signature !== config.flutterwave.webhookSecret) {
      console.error("Invalid webhook signature");
      return;
    }

    const event = req.body;
    console.log("Webhook received:", event.event, event.data?.tx_ref || event.data?.reference);

    // Handle charge.completed (user deposited NGN)
    if (event.event === "charge.completed" && event.data?.status === "successful") {
      const txRef = event.data.tx_ref;
      const order = await Order.findOne({ flwTxRef: txRef });

      if (!order) {
        console.error("No order found for tx_ref:", txRef);
        return;
      }

      // Verify the transaction with Flutterwave
      const verification = await verifyTransaction(event.data.id);
      if ((verification as any)?.data?.status !== "successful") {
        console.error("Transaction verification failed for:", txRef);
        return;
      }

      // Check amount matches
      const paidAmount = (verification as any)?.data?.amount;
      if (Math.abs(paidAmount - order.fiatAmount) > 1) {
        order.status = "amount-mismatch";
        order.errorLog = `Expected ${order.fiatAmount}, received ${paidAmount}`;
        await order.save();
        console.error("Amount mismatch:", order.errorLog);
        return;
      }

      // Confirm deposit on-chain (releases tokens from pool to user)
      try {
        const txid = await confirmDepositOnChain(order.onchainOrderId);
        order.onchainTxId = txid;
        order.status = "released";
        await order.save();
        console.log(`Deposit confirmed on-chain: order ${order.onchainOrderId}, txid: ${txid}`);
      } catch (chainError: any) {
        order.status = "fiat-received-chain-failed";
        order.errorLog = chainError.message;
        await order.save();
        console.error("On-chain deposit confirmation failed:", chainError.message);
      }
    }

    // Handle transfer.completed (payout to user's bank succeeded)
    if (event.event === "transfer.completed") {
      const reference = event.data?.reference;
      const order = await Order.findOne({ flwTxRef: reference });
      if (order && order.status !== "released") {
        try {
          const txid = await confirmWithdrawalOnChain(order.onchainOrderId);
          order.onchainTxId = txid;
          order.status = "released";
          await order.save();
        } catch (e: any) {
          console.error("Chain confirm on transfer.completed failed:", e.message);
        }
      }
    }

    // Handle transfer.failed (payout failed)
    if (event.event === "transfer.failed") {
      const reference = event.data?.reference;
      const order = await Order.findOne({ flwTxRef: reference });
      if (order) {
        order.status = "payout-failed";
        order.errorLog = `Payout failed: ${event.data?.complete_message || "unknown"}`;
        await order.save();
        console.error("Payout failed for order:", order.onchainOrderId);
        // TODO: Auto-refund via cancel-order on-chain
      }
    }
  } catch (error: any) {
    console.error("Webhook processing error:", error.message);
  }
});

export default router;

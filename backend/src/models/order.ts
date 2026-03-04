import mongoose, { Schema, Document } from "mongoose";

export interface IOrder extends Document {
  onchainOrderId: number;
  type: "deposit" | "withdrawal";
  fiatAmount: number;
  fiatCurrency: string;
  tokenAmount: number;
  rate: number;
  flwTxRef: string;
  onchainTxId: string;
  status: string;
  email: string;
  bankDetails: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
  };
  errorLog: string;
}

const OrderSchema = new Schema(
  {
    onchainOrderId: { type: Number, required: true, index: true },
    type: { type: String, enum: ["deposit", "withdrawal"], required: true },
    fiatAmount: { type: Number, required: true },
    fiatCurrency: { type: String, default: "NGN" },
    tokenAmount: { type: Number, required: true },
    rate: { type: Number, required: true },
    flwTxRef: { type: String, default: "" },
    onchainTxId: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "pending", "locked", "released", "cancelled", "disputed",
        "payout-sent-chain-pending", "fiat-received-chain-failed",
        "payout-failed", "amount-mismatch",
      ],
      default: "pending",
    },
    email: { type: String, default: "" },
    bankDetails: {
      bankCode: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      accountName: { type: String, default: "" },
    },
    errorLog: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>("Order", OrderSchema);

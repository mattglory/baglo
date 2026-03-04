import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  walletAddress: string;
  email: string;
  phone: string;
  fullName: string;
}

const UserSchema = new Schema(
  {
    walletAddress: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    fullName: { type: String, default: "" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);

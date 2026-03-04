import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  stacks: {
    network: process.env.STACKS_NETWORK || "testnet",
    apiUrl: process.env.STACKS_API_URL || "https://api.testnet.hiro.so",
    contractAddress: process.env.CONTRACT_ADDRESS || "",
    contractName: process.env.CONTRACT_NAME || "baglo-core",
    tokenContractAddress: process.env.TOKEN_CONTRACT_ADDRESS || "",
    tokenContractName: process.env.TOKEN_CONTRACT_NAME || "mock-usdcx",
    adminPrivateKey: process.env.ADMIN_PRIVATE_KEY || "",
  },
  flutterwave: {
    publicKey: process.env.FLW_PUBLIC_KEY || "",
    secretKey: process.env.FLW_SECRET_KEY || "",
    encryptionKey: process.env.FLW_ENCRYPTION_KEY || "",
    webhookSecret: process.env.FLW_WEBHOOK_SECRET || "",
  },
  apiKey: process.env.API_KEY || "",
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/baglo",
  rates: {
    NGN: parseInt(process.env.DEFAULT_NGN_RATE || "1600"),
    GBP: parseFloat(process.env.DEFAULT_GBP_RATE || "0.79"),
  },
};

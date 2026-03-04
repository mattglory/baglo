import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { config } from "./config";
import depositRoutes from "./routes/deposit";
import withdrawRoutes from "./routes/withdraw";
import webhookRoutes from "./routes/webhook";
import profileRoutes from "./routes/profile";
import { getLiveRate } from "./services/flutterwave";

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// API key guard for all /api/deposit and /api/withdraw routes
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (!config.apiKey) return next(); // skip if no key configured (dev mode)
  const key = req.headers["x-api-key"];
  if (key !== config.apiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Routes
app.use("/api/deposit", requireApiKey, depositRoutes);
app.use("/api/withdraw", requireApiKey, withdrawRoutes);
app.use("/api/webhook", webhookRoutes); // webhook uses its own signature check
app.use("/api/profile", profileRoutes); // public: wallet address is the key

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "baglo-backend",
    timestamp: new Date().toISOString(),
  });
});

// Quick rate endpoint
app.get("/api/rate/:currency", async (req, res) => {
  const currency = req.params.currency.toUpperCase();
  const rate = await getLiveRate("USD", currency);
  res.json({ rate, currency, base: "USD" });
});

// Connect MongoDB and start server
async function start() {
  try {
    if (config.mongoUri) {
      await mongoose.connect(config.mongoUri);
      console.log("Connected to MongoDB");
    } else {
      console.warn("No MONGODB_URI set - running without database");
    }
  } catch (err) {
    console.warn("MongoDB connection failed - running without database:", (err as Error).message);
  }

  app.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════╗
║       BAGLO BACKEND v1.0                ║
║       Port: ${config.port}                        ║
║       Network: ${config.stacks.network}                ║
║       Status: Running                    ║
╚══════════════════════════════════════════╝
    `);
  });
}

start();

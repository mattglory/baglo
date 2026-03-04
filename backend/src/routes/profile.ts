import { Router, Request, Response } from "express";
import { User } from "../models/user";

const router = Router();

/**
 * GET /api/profile/:address
 * Returns { exists: boolean, profile?: { walletAddress, email, phone, fullName } }
 */
router.get("/:address", async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ walletAddress: req.params.address });
    if (!user) {
      return res.json({ exists: false });
    }
    res.json({
      exists: true,
      profile: {
        walletAddress: user.walletAddress,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/profile
 * Upsert profile by wallet address
 * Body: { walletAddress, email, phone, fullName }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { walletAddress, email, phone, fullName } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required" });
    }
    const user = await User.findOneAndUpdate(
      { walletAddress },
      { $set: { email: email || "", phone: phone || "", fullName: fullName || "" } },
      { upsert: true, new: true }
    );
    res.json({
      success: true,
      profile: {
        walletAddress: user.walletAddress,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

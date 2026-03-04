"use client";

import React, { useState } from "react";
import { saveProfile } from "../lib/api";

interface Props {
  walletAddress: string;
  onComplete: () => void;
  onSkip: () => void;
}

export default function ProfileSetup({ walletAddress, onComplete, onSkip }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!fullName || !email) {
      setError("Full name and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await saveProfile({ walletAddress, fullName, email, phone });
      if (res.success) {
        localStorage.setItem(
          `baglo:profile:${walletAddress}`,
          JSON.stringify(res.profile)
        );
        onComplete();
      } else {
        setError(res.error || "Failed to save profile.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-1">Complete your profile</h2>
        <p className="text-xs text-white/40 mb-5">Takes 30 seconds — used for payment confirmations</p>

        <label className="block text-xs text-white/50 mb-1">Full Name *</label>
        <input
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d4aa] text-sm mb-3"
          placeholder="Oluwaseun Adebayo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <label className="block text-xs text-white/50 mb-1">Email *</label>
        <input
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d4aa] text-sm mb-3"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="block text-xs text-white/50 mb-1">Phone (optional)</label>
        <input
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d4aa] text-sm mb-4"
          placeholder="+234 800 000 0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        {error && (
          <p className="text-red-400 text-xs mb-3">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            className="flex-1 border border-white/15 text-white/50 rounded-xl py-3 text-sm font-medium hover:text-white hover:border-white/30 transition-colors"
            onClick={onSkip}
          >
            Skip
          </button>
          <button
            className="flex-[2] bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] text-black font-bold rounded-xl py-3 text-sm disabled:opacity-40"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Saving..." : "Save Profile →"}
          </button>
        </div>
      </div>
    </div>
  );
}

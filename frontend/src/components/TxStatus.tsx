"use client";

import React from "react";

export type TxStep = {
  label: string;
  state: "pending" | "active" | "done" | "error";
};

interface Props {
  steps: TxStep[];
  txId?: string;
  isMainnet?: boolean;
}

export default function TxStatus({ steps, txId, isMainnet = false }: Props) {
  const explorerBase = isMainnet
    ? "https://explorer.hiro.so/txid"
    : "https://explorer.hiro.so/txid?chain=testnet";

  return (
    <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-lg">
              {step.state === "done" ? "✓" : step.state === "error" ? "✗" : step.state === "active" ? "◉" : "○"}
            </span>
            <span
              className={`text-sm ${
                step.state === "done"
                  ? "text-[#00d4aa]"
                  : step.state === "error"
                  ? "text-red-400"
                  : step.state === "active"
                  ? "text-white"
                  : "text-white/40"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {txId && (
        <a
          href={`${explorerBase}/${txId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-xs text-[#00d4aa] underline underline-offset-2 block"
        >
          View on Explorer ↗
        </a>
      )}
    </div>
  );
}

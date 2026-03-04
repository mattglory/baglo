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

function StepIcon({ state }: { state: TxStep["state"] }) {
  if (state === "done") {
    return (
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#00d4aa] flex items-center justify-center">
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3 5.5L8 1" stroke="black" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center">
        <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
          <path d="M1 1L6 6M6 1L1 6" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-[#00d4aa] border-t-transparent animate-spin" />
    );
  }
  // pending
  return (
    <span className="flex-shrink-0 w-5 h-5 rounded-full border border-white/20" />
  );
}

export default function TxStatus({ steps, txId, isMainnet = false }: Props) {
  const explorerBase = isMainnet
    ? "https://explorer.hiro.so/txid"
    : "https://explorer.hiro.so/txid";
  const chainParam = isMainnet ? "" : "?chain=testnet";

  return (
    <div className="mt-2 bg-white/3 border border-white/8 rounded-2xl p-4">
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <StepIcon state={step.state} />
            <span
              className={`text-sm leading-tight ${
                step.state === "done"
                  ? "text-[#00d4aa]"
                  : step.state === "error"
                  ? "text-red-400"
                  : step.state === "active"
                  ? "text-white"
                  : "text-white/35"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {txId && (
        <a
          href={`${explorerBase}/${txId}${chainParam}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-xs text-[#00d4aa]/70 hover:text-[#00d4aa] underline underline-offset-2 flex items-center gap-1 transition-colors"
        >
          View on Stacks Explorer ↗
        </a>
      )}
    </div>
  );
}

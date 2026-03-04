"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  connectWallet,
  disconnectWallet,
  isWalletConnected,
  getUserAddress,
  getTokenBalance,
  createDeposit,
  createWithdrawal,
  sendToExternal,
  waitForTxAndGetOrderId,
  isValidStacksAddress,
  CORE_CONTRACT,
} from "../lib/stacks";
import {
  getRate,
  initiateDeposit,
  initiateWithdrawal,
  resolveAccount,
  getNigerianBanks,
  getProfile,
} from "../lib/api";
import ProfileSetup from "./ProfileSetup";
import TxStatus, { TxStep } from "./TxStatus";

type Tab = "deposit" | "withdraw" | "send" | "receive";

interface Bank {
  code: string;
  name: string;
}

const DECIMALS = 6;
const MICRO = Math.pow(10, DECIMALS);

function toSmallestUnit(val: number): number {
  return Math.floor(val * MICRO);
}

function fromSmallestUnit(val: number): string {
  return (val / MICRO).toFixed(2);
}

export default function BagloApp() {
  // Wallet state
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>("deposit");
  const [txSteps, setTxSteps] = useState<TxStep[]>([]);
  const [txId, setTxId] = useState<string | undefined>();
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [rate, setRate] = useState<number>(1600);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);

  // ============================================================
  // INIT
  // ============================================================

  useEffect(() => {
    if (isWalletConnected()) {
      const addr = getUserAddress();
      if (addr) setAddress(addr);
    }
  }, []);

  useEffect(() => {
    if (address) {
      loadBalance();
      checkProfile(address);
    }
  }, [address]);

  useEffect(() => {
    getRate("NGN").then((r) => setRate(r.rate || 1600)).catch(() => {});
    getNigerianBanks().then((r) => setBanks(r.data || [])).catch(() => {});
  }, []);

  // Auto-resolve bank account name when 10-digit number + bank selected
  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) {
      resolveAccount(bankCode, accountNumber)
        .then((r) => { if (r?.data?.account_name) setAccountName(r.data.account_name); })
        .catch(() => {});
    } else {
      setAccountName("");
    }
  }, [accountNumber, bankCode]);

  const checkProfile = async (addr: string) => {
    const cached = localStorage.getItem(`baglo:profile:${addr}`);
    if (cached) return;
    try {
      const res = await getProfile(addr);
      if (!res.exists) {
        setShowProfileSetup(true);
      } else {
        localStorage.setItem(`baglo:profile:${addr}`, JSON.stringify(res.profile));
        if (res.profile?.email) setEmail(res.profile.email);
      }
    } catch {
      // Silently fail — backend might not be running during local dev
    }
  };

  const loadBalance = useCallback(async () => {
    if (!address) return;
    try {
      const bal = await getTokenBalance("USDCx", address);
      setBalance(parseInt(String(bal)) || 0);
    } catch {
      setBalance(0);
    }
  }, [address]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const amountNum = parseFloat(amount) || 0;

  // Deposit: user pays NGN → receives USDCx
  // e.g. ₦16,000 ÷ 1600 rate = 10 USDCx → 9.97 after 0.3% fee
  const depositUsdcxRaw = rate > 0 ? amountNum / rate : 0;
  const depositUsdcxAfterFee = depositUsdcxRaw * 0.997;
  const depositFee = depositUsdcxRaw * 0.003;

  // Withdraw: user sells USDCx → receives NGN
  // e.g. 10 USDCx × 1600 rate = ₦16,000 → ₦15,952 after 0.3% fee
  const withdrawNgnRaw = amountNum * rate;
  const withdrawNgnAfterFee = Math.floor(withdrawNgnRaw * 0.997);
  const withdrawNgnFee = Math.floor(withdrawNgnRaw * 0.003);

  // Send
  const sendFee = (amountNum * 0.003).toFixed(4);

  const balanceDisplay = fromSmallestUnit(balance);
  const balanceNgn = (parseFloat(balanceDisplay) * rate).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const addressValid = recipientAddress ? isValidStacksAddress(recipientAddress) : null;

  // ============================================================
  // HELPERS
  // ============================================================

  const resetState = () => {
    setTxSteps([]);
    setTxId(undefined);
    setSuccessMsg("");
    setErrorMsg("");
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    resetState();
    setAmount("");
  };

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard
      const el = document.createElement("textarea");
      el.value = address;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = () => connectWallet((addr) => setAddress(addr));

  const handleDisconnect = () => {
    disconnectWallet();
    setAddress(null);
    setBalance(0);
    setShowProfileSetup(false);
  };

  // --- DEPOSIT: Buy USDCx with NGN ---
  // User inputs NGN amount → we calculate USDCx to receive
  const handleDeposit = async () => {
    if (!amount || !email || amountNum <= 0) return;
    setBusy(true);
    resetState();
    setTxSteps([
      { label: "Sign on-chain order", state: "active" },
      { label: "Confirming on Stacks (~90s)", state: "pending" },
      { label: "Generating NGN payment account", state: "pending" },
    ]);

    createDeposit({
      fiatCurrency: "NGN",
      fiatAmount: Math.floor(amountNum),               // NGN amount user will pay
      tokenAmount: toSmallestUnit(depositUsdcxAfterFee), // USDCx micro-units to receive
      onFinish: async (data: any) => {
        const id = data.txId as string;
        setTxId(id);
        setTxSteps([
          { label: "Sign on-chain order", state: "done" },
          { label: "Confirming on Stacks (~90s)", state: "active" },
          { label: "Generating NGN payment account", state: "pending" },
        ]);

        try {
          const orderId = await waitForTxAndGetOrderId(id, address!);
          setTxSteps([
            { label: "Sign on-chain order", state: "done" },
            { label: "Confirming on Stacks (~90s)", state: "done" },
            { label: "Generating NGN payment account", state: "active" },
          ]);

          const result = await initiateDeposit({
            email,
            fiatAmount: Math.floor(amountNum),
            fiatCurrency: "NGN",
            onchainOrderId: orderId,
          });

          if (result.success) {
            setTxSteps([
              { label: "Sign on-chain order", state: "done" },
              { label: "Confirming on Stacks (~90s)", state: "done" },
              { label: "Generating NGN payment account", state: "done" },
            ]);
            const d = result.transferDetails;
            setSuccessMsg(
              `Transfer ₦${Math.floor(amountNum).toLocaleString()} to:\n` +
              `Bank: ${d?.bank_name || "Providus Bank"}\n` +
              `Account: ${d?.account_number || "—"}\n` +
              `Name: ${d?.account_name || "BAGLO FINANCE LTD"}\n\n` +
              `Valid for 24 hours. Check your email for instructions.`
            );
          } else {
            setTxSteps((s) => s.map((x) => x.state === "active" ? { ...x, state: "error" } : x));
            setErrorMsg(result.error || "Failed to generate payment account.");
          }
        } catch (e: any) {
          setTxSteps((s) => s.map((x) => x.state === "active" ? { ...x, state: "error" } : x));
          setErrorMsg(e.message);
        } finally {
          setBusy(false);
        }
      },
      onCancel: () => { resetState(); setBusy(false); },
    });
  };

  // --- WITHDRAW: Sell USDCx for NGN ---
  const handleWithdraw = async () => {
    if (!amount || !bankCode || !accountNumber || amountNum <= 0) return;
    setBusy(true);
    resetState();
    setTxSteps([
      { label: `Lock ${amount} USDCx on Stacks`, state: "active" },
      { label: "Confirming lock (~90s)", state: "pending" },
      { label: `Sending ₦${withdrawNgnAfterFee.toLocaleString()} to your bank`, state: "pending" },
    ]);

    createWithdrawal({
      tokenSymbol: "USDCx",
      amount: toSmallestUnit(amountNum),
      fiatCurrency: "NGN",
      fiatAmount: withdrawNgnAfterFee,
      onFinish: async (data: any) => {
        const id = data.txId as string;
        setTxId(id);
        setTxSteps([
          { label: `Lock ${amount} USDCx on Stacks`, state: "done" },
          { label: "Confirming lock (~90s)", state: "active" },
          { label: `Sending ₦${withdrawNgnAfterFee.toLocaleString()} to your bank`, state: "pending" },
        ]);

        try {
          const orderId = await waitForTxAndGetOrderId(id, address!);
          setTxSteps([
            { label: `Lock ${amount} USDCx on Stacks`, state: "done" },
            { label: "Confirming lock (~90s)", state: "done" },
            { label: `Sending ₦${withdrawNgnAfterFee.toLocaleString()} to your bank`, state: "active" },
          ]);

          const result = await initiateWithdrawal({
            onchainOrderId: orderId,
            tokenAmount: toSmallestUnit(amountNum),
            bankCode,
            accountNumber,
            accountName,
            fiatCurrency: "NGN",
            email,
          });

          if (result.success) {
            setTxSteps([
              { label: `Lock ${amount} USDCx on Stacks`, state: "done" },
              { label: "Confirming lock (~90s)", state: "done" },
              { label: `Sending ₦${withdrawNgnAfterFee.toLocaleString()} to your bank`, state: "done" },
            ]);
            setSuccessMsg(
              `₦${withdrawNgnAfterFee.toLocaleString()} sent to ${accountName}!\nArrives in under 2 minutes.`
            );
            loadBalance();
          } else {
            setTxSteps((s) => s.map((x) => x.state === "active" ? { ...x, state: "error" } : x));
            setErrorMsg(result.error || "Payout failed.");
          }
        } catch (e: any) {
          setTxSteps((s) => s.map((x) => x.state === "active" ? { ...x, state: "error" } : x));
          setErrorMsg(e.message);
        } finally {
          setBusy(false);
        }
      },
      onCancel: () => { resetState(); setBusy(false); },
    });
  };

  // --- SEND: Wallet-to-wallet ---
  const handleSend = () => {
    if (!amount || !recipientAddress || amountNum <= 0) return;
    if (!isValidStacksAddress(recipientAddress)) {
      setErrorMsg("Invalid Stacks address. Must start with SP or ST.");
      return;
    }
    setBusy(true);
    resetState();
    setTxSteps([{ label: `Send ${amount} USDCx`, state: "active" }]);

    sendToExternal({
      tokenSymbol: "USDCx",
      amount: toSmallestUnit(amountNum),
      recipientAddress,
      onFinish: (data: any) => {
        setTxId(data.txId);
        setTxSteps([{ label: `Send ${amount} USDCx`, state: "done" }]);
        setSuccessMsg(
          `Sent ${amount} USDCx to ${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-4)}`
        );
        loadBalance();
        setBusy(false);
      },
      onCancel: () => { resetState(); setBusy(false); },
    });
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center py-8 px-4">
      {showProfileSetup && address && (
        <ProfileSetup
          walletAddress={address}
          onComplete={() => setShowProfileSetup(false)}
          onSkip={() => setShowProfileSetup(false)}
        />
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] bg-clip-text text-transparent">
            BAGLO
          </h1>
          <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full px-2.5 py-1 uppercase tracking-wider">
            Testnet
          </span>
        </div>
        <p className="text-sm text-white/40">Instant NGN ↔ USDCx · Built on Bitcoin via Stacks</p>
      </div>

      {/* ── NOT CONNECTED ── */}
      {!address ? (
        <div className="text-center mt-10 max-w-xs">
          <div className="mb-6 text-white/15">
            <svg className="mx-auto w-14 h-14 mb-5" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="18" width="44" height="28" rx="5" stroke="currentColor" strokeWidth="2"/>
              <path d="M6 27h44" stroke="currentColor" strokeWidth="2"/>
              <circle cx="18" cy="35" r="3" fill="currentColor" opacity="0.6"/>
              <path d="M28 14v-4M24 12l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-white/40 text-sm mb-6">
            Connect your Hiro or Leather wallet to start trading
          </p>
          <button
            className="bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] text-black font-bold rounded-xl px-10 py-3.5 text-base hover:opacity-90 active:scale-95 transition-all"
            onClick={handleConnect}
          >
            Connect Wallet
          </button>
          <p className="mt-5 text-xs text-white/20">
            Stacks Testnet · Non-custodial · No KYC required
          </p>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          {/* Balance card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40 font-medium uppercase tracking-wider">Balance</span>
              <button
                className="text-xs text-white/30 hover:text-red-400 transition-colors"
                onClick={handleDisconnect}
              >
                {address.slice(0, 6)}…{address.slice(-4)} · Disconnect
              </button>
            </div>
            <div className="text-3xl font-extrabold text-white">
              {balanceDisplay}{" "}
              <span className="text-lg text-[#00d4aa] font-semibold">USDCx</span>
            </div>
            <div className="mt-1 text-sm text-white/30">
              ≈ ₦{balanceNgn}
            </div>
            <div className="mt-3 flex items-center gap-2 bg-[#00d4aa]/8 border border-[#00d4aa]/15 rounded-lg px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-pulse flex-shrink-0" />
              <span className="text-xs text-[#00d4aa] font-medium">1 USDCx = ₦{rate.toLocaleString()}</span>
              <span className="text-white/20 text-xs ml-auto">0.3% fee</span>
            </div>
          </div>

          {/* Tabs — pill style */}
          <div className="flex gap-1 mb-4 bg-white/5 border border-white/10 rounded-xl p-1">
            {(["deposit", "withdraw", "send", "receive"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? "bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] text-black"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {tab === "deposit" ? "Buy" : tab === "withdraw" ? "Sell" : tab === "send" ? "Send" : "Receive"}
              </button>
            ))}
          </div>

          {/* Form card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">

            {/* ── BUY TAB ── */}
            {activeTab === "deposit" && (
              <>
                {/* NGN input — what user pays */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-white/50">You pay</label>
                    <span className="text-xs text-white/30">Nigerian Naira</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-semibold text-lg leading-none">₦</span>
                    <input
                      className="w-full bg-[#111] border border-white/15 rounded-xl pl-9 pr-16 py-3.5 text-white text-xl font-bold placeholder-white/20 focus:outline-none focus:border-[#00d4aa] transition-colors"
                      type="number"
                      min="0"
                      placeholder="16,000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40 bg-white/8 rounded px-2 py-0.5">
                      NGN
                    </span>
                  </div>
                </div>

                {/* Conversion arrow */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-[#00d4aa] text-base select-none">↓</span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>

                {/* USDCx output — what user receives */}
                <div className="bg-[#00d4aa]/8 border border-[#00d4aa]/20 rounded-xl px-4 py-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/40">You receive</span>
                    <span className="text-xs text-white/30">after 0.3% fee</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[#00d4aa] font-bold text-2xl">
                      {amountNum > 0 ? depositUsdcxAfterFee.toFixed(2) : "0.00"}
                    </span>
                    <span className="text-[#00d4aa]/70 font-semibold">USDCx</span>
                  </div>
                  {amountNum > 0 && (
                    <p className="text-xs text-white/25 mt-1">
                      ₦{Math.floor(amountNum).toLocaleString()} ÷ {rate.toLocaleString()} = {depositUsdcxRaw.toFixed(4)} USDCx · fee {depositFee.toFixed(4)}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">
                    Email for payment instructions
                  </label>
                  <input
                    className="w-full bg-[#111] border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d4aa] text-sm transition-colors"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  className="w-full bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] text-black font-bold rounded-xl py-4 disabled:opacity-40 active:scale-[0.98] transition-all"
                  disabled={busy || !amount || !email || amountNum <= 0}
                  onClick={handleDeposit}
                >
                  {busy ? "Processing…" : "Buy USDCx →"}
                </button>
              </>
            )}

            {/* ── SELL TAB ── */}
            {activeTab === "withdraw" && (
              <>
                {/* USDCx input — what user sells */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-white/50">You sell</label>
                    <span className="text-xs text-white/30">USDCx Stablecoin</span>
                  </div>
                  <div className="relative">
                    <input
                      className="w-full bg-[#111] border border-white/15 rounded-xl px-4 pr-24 py-3.5 text-white text-xl font-bold placeholder-white/20 focus:outline-none focus:border-[#00d4aa] transition-colors"
                      type="number"
                      min="0"
                      placeholder="10"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#00d4aa]/70 bg-[#00d4aa]/10 rounded px-2 py-0.5">
                      USDCx
                    </span>
                  </div>
                  {balance > 0 && (
                    <button
                      className="text-xs text-[#00d4aa]/50 mt-1.5 hover:text-[#00d4aa] transition-colors"
                      onClick={() => setAmount(balanceDisplay)}
                    >
                      Max: {balanceDisplay} USDCx
                    </button>
                  )}
                </div>

                {/* Conversion arrow */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-[#00d4aa] text-base select-none">↓</span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>

                {/* NGN output */}
                <div className="bg-[#00d4aa]/8 border border-[#00d4aa]/20 rounded-xl px-4 py-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/40">You receive</span>
                    <span className="text-xs text-white/30">after 0.3% fee</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[#00d4aa] font-bold text-2xl">
                      ₦{amountNum > 0 ? withdrawNgnAfterFee.toLocaleString() : "0"}
                    </span>
                  </div>
                  {amountNum > 0 && (
                    <p className="text-xs text-white/25 mt-1">
                      {amount} × ₦{rate.toLocaleString()} = ₦{Math.floor(withdrawNgnRaw).toLocaleString()} · fee ₦{withdrawNgnFee.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Bank */}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Bank</label>
                  <select
                    className="w-full bg-[#111] border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00d4aa] text-sm transition-colors"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                  >
                    <option value="">Select Bank</option>
                    {banks.map((b) => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Account number */}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Account Number</label>
                  <input
                    className="w-full bg-[#111] border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d4aa] text-sm tracking-widest transition-colors"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="0123456789"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  />
                  {accountName && (
                    <p className="text-[#00d4aa] text-xs mt-1.5 flex items-center gap-1.5">
                      <CheckIcon />
                      {accountName}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Email (optional)</label>
                  <input
                    className="w-full bg-[#111] border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d4aa] text-sm transition-colors"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  className="w-full bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] text-black font-bold rounded-xl py-4 disabled:opacity-40 active:scale-[0.98] transition-all"
                  disabled={busy || !amount || !bankCode || !accountNumber || amountNum <= 0}
                  onClick={handleWithdraw}
                >
                  {busy ? "Processing…" : "Sell USDCx →"}
                </button>
              </>
            )}

            {/* ── SEND TAB ── */}
            {activeTab === "send" && (
              <>
                {/* Recipient */}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">
                    Recipient Stacks address
                  </label>
                  <input
                    className={`w-full bg-[#111] border rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none text-sm font-mono transition-colors ${
                      addressValid === false
                        ? "border-red-500/60 focus:border-red-500"
                        : addressValid === true
                        ? "border-[#00d4aa]/50 focus:border-[#00d4aa]"
                        : "border-white/15 focus:border-[#00d4aa]"
                    }`}
                    type="text"
                    placeholder="ST1... or SP1..."
                    value={recipientAddress}
                    onChange={(e) => { setRecipientAddress(e.target.value); setErrorMsg(""); }}
                  />
                  {addressValid === true && (
                    <p className="text-[#00d4aa] text-xs mt-1.5 flex items-center gap-1.5">
                      <CheckIcon />Valid Stacks address
                    </p>
                  )}
                  {addressValid === false && recipientAddress && (
                    <p className="text-red-400 text-xs mt-1.5">
                      Invalid address — must start with SP or ST
                    </p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-white/50">Amount</label>
                    {balance > 0 && (
                      <button
                        className="text-xs text-[#00d4aa]/50 hover:text-[#00d4aa] transition-colors"
                        onClick={() => setAmount(balanceDisplay)}
                      >
                        Max: {balanceDisplay}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      className="w-full bg-[#111] border border-white/15 rounded-xl px-4 pr-24 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-[#00d4aa] text-xl font-bold transition-colors"
                      type="number"
                      min="0"
                      placeholder="5"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#00d4aa]/70 bg-[#00d4aa]/10 rounded px-2 py-0.5">
                      USDCx
                    </span>
                  </div>
                </div>

                {amountNum > 0 && (
                  <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-xs text-white/40 space-y-1">
                    <div className="flex justify-between">
                      <span>Protocol fee (0.3%)</span>
                      <span>{sendFee} USDCx</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Network fee</span>
                      <span>~0.001 STX</span>
                    </div>
                  </div>
                )}

                <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300/80">
                  Sends to any Stacks wallet address. To cash out to your Nigerian bank account, use the{" "}
                  <button
                    className="font-semibold text-amber-300 underline underline-offset-2"
                    onClick={() => switchTab("withdraw")}
                  >
                    Sell
                  </button>{" "}
                  tab.
                </div>

                <button
                  className="w-full bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] text-black font-bold rounded-xl py-4 disabled:opacity-40 active:scale-[0.98] transition-all"
                  disabled={busy || !amount || !recipientAddress || !addressValid || amountNum <= 0}
                  onClick={handleSend}
                >
                  {busy ? "Processing…" : "Send USDCx →"}
                </button>
              </>
            )}

            {/* ── RECEIVE TAB ── */}
            {activeTab === "receive" && (
              <div className="space-y-4">
                {/* QR Code */}
                <div className="flex flex-col items-center gap-3 pt-1">
                  <div className="bg-white rounded-2xl p-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${address}&margin=4`}
                      alt="Wallet QR code"
                      width={176}
                      height={176}
                      className="rounded-lg"
                    />
                  </div>
                  <p className="text-xs text-white/40 text-center">
                    Scan to send USDCx to this wallet
                  </p>
                </div>

                {/* Address display + copy */}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Your Stacks address</label>
                  <div className="flex items-center gap-2 bg-[#111] border border-white/15 rounded-xl px-4 py-3">
                    <span className="flex-1 text-xs font-mono text-white/70 break-all leading-relaxed">
                      {address}
                    </span>
                    <button
                      onClick={handleCopyAddress}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        copied
                          ? "bg-[#00d4aa]/20 text-[#00d4aa]"
                          : "bg-white/8 text-white/50 hover:bg-white/15 hover:text-white"
                      }`}
                    >
                      {copied ? (
                        <>
                          <CheckIcon />
                          Copied
                        </>
                      ) : (
                        "Copy"
                      )}
                    </button>
                  </div>
                </div>

                {/* Network badge */}
                <div className="flex items-center gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-xs text-amber-300/80">
                    Stacks Testnet — only send testnet tokens to this address
                  </span>
                </div>

                {/* How to receive instructions */}
                <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-4 space-y-3">
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    How to receive from exchanges
                  </p>

                  <div className="space-y-2.5">
                    {[
                      {
                        name: "Bitget / OKX / KuCoin",
                        steps: "Withdraw → Select STX or USDCx → Network: Stacks → Paste your address above",
                      },
                      {
                        name: "Binance",
                        steps: "Wallet → Withdraw → Search USDCx → Network: Stacks (STX) → Paste address",
                      },
                      {
                        name: "Another Stacks wallet",
                        steps: "Send → Stacks address → Paste your address → Confirm in Hiro/Leather",
                      },
                    ].map(({ name, steps }) => (
                      <div key={name} className="flex gap-3">
                        <span className="w-1 h-1 rounded-full bg-[#00d4aa]/50 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-white/60">{name}</p>
                          <p className="text-xs text-white/35 mt-0.5">{steps}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Token note */}
                <p className="text-xs text-white/25 text-center">
                  This address accepts USDCx, STX, and any SIP-010 token on Stacks
                </p>
              </div>
            )}

            {/* Tx progress */}
            {txSteps.length > 0 && (
              <TxStatus steps={txSteps} txId={txId} />
            )}

            {/* Success */}
            {successMsg && (
              <div className="bg-[#00d4aa]/8 border border-[#00d4aa]/25 rounded-xl p-4 text-[#00d4aa] text-sm whitespace-pre-line">
                {successMsg}
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div className="bg-red-500/8 border border-red-500/25 rounded-xl p-4 text-red-400 text-sm">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Refresh balance */}
          <button
            className="mt-3 text-xs text-white/20 hover:text-white/40 transition-colors w-full text-center py-2"
            onClick={loadBalance}
          >
            ↻ Refresh balance
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 text-center space-y-1">
        <p className="text-xs text-white/20">Built on Stacks · Bitcoin security · Non-custodial</p>
        <a
          href={`https://explorer.hiro.so/address/${CORE_CONTRACT.address}?chain=testnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/15 hover:text-[#00d4aa]/50 transition-colors"
        >
          {CORE_CONTRACT.address.slice(0, 12)}…{CORE_CONTRACT.address.slice(-6)}.baglo-core ↗
        </a>
      </footer>
    </div>
  );
}

// ── Small SVG check icon ──
function CheckIcon() {
  return (
    <span className="w-3.5 h-3.5 rounded-full bg-[#00d4aa] flex items-center justify-center flex-shrink-0">
      <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
        <path d="M1 3L2.5 4.5L6 1" stroke="black" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

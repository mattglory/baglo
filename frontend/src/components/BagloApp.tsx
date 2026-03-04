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
  SUPPORTED_TOKENS,
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

type Tab = "deposit" | "withdraw" | "send";

interface Bank {
  code: string;
  name: string;
}

export default function BagloApp() {
  // Wallet / profile state
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [selectedToken, setSelectedToken] = useState("USDCx");
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>("deposit");
  const [txSteps, setTxSteps] = useState<TxStep[]>([]);
  const [txId, setTxId] = useState<string | undefined>();
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [rate, setRate] = useState<number>(1600);
  const [busy, setBusy] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);

  // ============================================================
  // INITIALIZATION
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
  }, [address, selectedToken]);

  useEffect(() => {
    getRate("NGN").then((r) => setRate(r.rate || 1600)).catch(() => {});
    getNigerianBanks()
      .then((r) => setBanks(r.data || []))
      .catch(() => {});
  }, []);

  // Auto-resolve bank account
  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) {
      resolveAccount(bankCode, accountNumber)
        .then((r) => {
          if (r?.data?.account_name) setAccountName(r.data.account_name);
        })
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
      // Silently fail — don't block UX if backend is down
    }
  };

  const loadBalance = useCallback(async () => {
    if (!address) return;
    try {
      const bal = await getTokenBalance(selectedToken, address);
      setBalance(parseInt(bal) || 0);
    } catch {
      setBalance(0);
    }
  }, [address, selectedToken]);

  // ============================================================
  // HELPERS
  // ============================================================

  const token = SUPPORTED_TOKENS[selectedToken];

  const toSmallestUnit = (val: string) =>
    Math.floor(parseFloat(val || "0") * Math.pow(10, token.decimals));

  const fromSmallestUnit = (val: number) =>
    (val / Math.pow(10, token.decimals)).toFixed(token.decimals === 6 ? 2 : 6);

  const fiatAmount = amount ? Math.floor(parseFloat(amount) * rate) : 0;
  const fiatAfterFee = amount ? Math.floor(fiatAmount * 0.997) : 0;

  const tokenAfterFee = amount ? (parseFloat(amount) * 0.997).toFixed(2) : "0.00";

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

  const handleConnect = () => {
    connectWallet((addr) => setAddress(addr));
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setAddress(null);
    setBalance(0);
    setShowProfileSetup(false);
  };

  // --- DEPOSIT: Buy stablecoins with NGN ---
  const handleDeposit = async () => {
    if (!amount || !email || parseFloat(amount) <= 0) return;
    setBusy(true);
    resetState();
    setTxSteps([
      { label: "Sign deposit order", state: "active" },
      { label: "Confirming on-chain (~90s)", state: "pending" },
      { label: "Generating payment account", state: "pending" },
    ]);

    createDeposit({
      fiatCurrency: "NGN",
      fiatAmount: fiatAmount,
      tokenAmount: toSmallestUnit(amount),
      onFinish: async (data: any) => {
        const id = data.txId as string;
        setTxId(id);
        setTxSteps([
          { label: "Sign deposit order", state: "done" },
          { label: "Confirming on-chain (~90s)", state: "active" },
          { label: "Generating payment account", state: "pending" },
        ]);

        try {
          const orderId = await waitForTxAndGetOrderId(id, address!);
          setTxSteps([
            { label: "Sign deposit order", state: "done" },
            { label: "Confirming on-chain (~90s)", state: "done" },
            { label: "Generating payment account", state: "active" },
          ]);

          const result = await initiateDeposit({
            email,
            fiatAmount: fiatAmount,
            fiatCurrency: "NGN",
            onchainOrderId: orderId,
          });

          if (result.success) {
            setTxSteps([
              { label: "Sign deposit order", state: "done" },
              { label: "Confirming on-chain (~90s)", state: "done" },
              { label: "Generating payment account", state: "done" },
            ]);
            const d = result.transferDetails;
            setSuccessMsg(
              `Transfer ₦${fiatAmount.toLocaleString()} to:\n` +
              `Bank: ${d?.bank_name || "Providus Bank"}\n` +
              `Account: ${d?.account_number || "—"}\n` +
              `Name: ${d?.account_name || "BAGLO FINANCE LTD"}\n\n` +
              `Valid for 24 hours. Check your email for full instructions.`
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
      onCancel: () => {
        resetState();
        setBusy(false);
      },
    });
  };

  // --- WITHDRAW: Sell stablecoins for NGN ---
  const handleWithdraw = async () => {
    if (!amount || !bankCode || !accountNumber || parseFloat(amount) <= 0) return;
    setBusy(true);
    resetState();
    setTxSteps([
      { label: `Lock ${amount} ${token.symbol} on-chain`, state: "active" },
      { label: "Confirming lock (~90s)", state: "pending" },
      { label: `Sending ₦${fiatAfterFee.toLocaleString()} to your bank`, state: "pending" },
    ]);

    createWithdrawal({
      tokenSymbol: selectedToken,
      amount: toSmallestUnit(amount),
      fiatCurrency: "NGN",
      fiatAmount: fiatAfterFee,
      onFinish: async (data: any) => {
        const id = data.txId as string;
        setTxId(id);
        setTxSteps([
          { label: `Lock ${amount} ${token.symbol} on-chain`, state: "done" },
          { label: "Confirming lock (~90s)", state: "active" },
          { label: `Sending ₦${fiatAfterFee.toLocaleString()} to your bank`, state: "pending" },
        ]);

        try {
          const orderId = await waitForTxAndGetOrderId(id, address!);
          setTxSteps([
            { label: `Lock ${amount} ${token.symbol} on-chain`, state: "done" },
            { label: "Confirming lock (~90s)", state: "done" },
            { label: `Sending ₦${fiatAfterFee.toLocaleString()} to your bank`, state: "active" },
          ]);

          const result = await initiateWithdrawal({
            onchainOrderId: orderId,
            tokenAmount: toSmallestUnit(amount),
            bankCode,
            accountNumber,
            accountName,
            fiatCurrency: "NGN",
            email,
          });

          if (result.success) {
            setTxSteps([
              { label: `Lock ${amount} ${token.symbol} on-chain`, state: "done" },
              { label: "Confirming lock (~90s)", state: "done" },
              { label: `Sending ₦${fiatAfterFee.toLocaleString()} to your bank`, state: "done" },
            ]);
            setSuccessMsg(
              `₦${fiatAfterFee.toLocaleString()} sent to ${accountName}! Arrives in under 2 minutes.`
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
      onCancel: () => {
        resetState();
        setBusy(false);
      },
    });
  };

  // --- SEND: Wallet-to-wallet transfer ---
  const handleSend = () => {
    if (!amount || !recipientAddress || parseFloat(amount) <= 0) return;
    if (!isValidStacksAddress(recipientAddress)) {
      setErrorMsg("Invalid Stacks address. Must start with SP or ST.");
      return;
    }
    setBusy(true);
    resetState();
    setTxSteps([
      { label: `Send ${amount} ${token.symbol}`, state: "active" },
    ]);

    sendToExternal({
      tokenSymbol: selectedToken,
      amount: toSmallestUnit(amount),
      recipientAddress,
      onFinish: (data: any) => {
        setTxId(data.txId);
        setTxSteps([{ label: `Send ${amount} ${token.symbol}`, state: "done" }]);
        setSuccessMsg(`Sent ${amount} ${token.symbol} to ${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-4)}`);
        loadBalance();
        setBusy(false);
      },
      onCancel: () => {
        resetState();
        setBusy(false);
      },
    });
  };

  // ============================================================
  // COMPUTED FEE
  // ============================================================

  const protocolFeeDisplay = amount
    ? (parseFloat(amount) * 0.003).toFixed(token.decimals === 6 ? 4 : 6)
    : "0";

  const addressValid = recipientAddress ? isValidStacksAddress(recipientAddress) : null;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center py-8 px-4">
      {/* Profile setup modal */}
      {showProfileSetup && address && (
        <ProfileSetup
          walletAddress={address}
          onComplete={() => setShowProfileSetup(false)}
          onSkip={() => setShowProfileSetup(false)}
        />
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] bg-clip-text text-transparent">
          BAGLO
        </h1>
        <p className="text-sm text-white/40 mt-1">Instant Crypto ↔ Fiat · Nigeria</p>
      </div>

      {/* Wallet not connected */}
      {!address ? (
        <div className="text-center mt-10">
          <p className="text-white/40 text-sm mb-6">Connect your Stacks wallet to start trading</p>
          <button
            className="bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] text-black font-bold rounded-xl px-8 py-3 text-base hover:opacity-90 transition-opacity"
            onClick={handleConnect}
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          {/* Balance card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <select
                className="bg-transparent text-[#00d4aa] font-bold text-sm focus:outline-none cursor-pointer"
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
              >
                {Object.entries(SUPPORTED_TOKENS).map(([key, t]) => (
                  <option key={key} value={key} className="bg-[#111] text-white">
                    {t.symbol}
                  </option>
                ))}
              </select>
              <button
                className="text-xs text-white/30 hover:text-red-400 transition-colors"
                onClick={handleDisconnect}
              >
                {address.slice(0, 6)}…{address.slice(-4)} · Disconnect
              </button>
            </div>
            <div className="text-3xl font-extrabold text-white">
              {fromSmallestUnit(balance)}{" "}
              <span className="text-lg text-white/50">{token.symbol}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 bg-[#00d4aa]/10 rounded-lg px-3 py-1.5">
              <span className="text-xs text-[#00d4aa]">1 USD = ₦{rate.toLocaleString()}</span>
              <span className="text-white/20">·</span>
              <span className="text-xs text-white/40">Fee 0.3%</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {(["deposit", "withdraw", "send"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? "border-2 border-[#00d4aa] bg-[#00d4aa]/15 text-[#00d4aa]"
                    : "border border-white/10 text-white/50 hover:text-white/70"
                }`}
              >
                {tab === "deposit" ? "Buy" : tab === "withdraw" ? "Sell" : "Send"}
              </button>
            ))}
          </div>

          {/* Form card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            {/* BUY TAB */}
            {activeTab === "deposit" && (
              <>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">You pay (NGN)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-lg">₦</span>
                    <input
                      className="w-full bg-white/5 border border-white/15 rounded-xl pl-8 pr-4 py-3 text-white text-xl font-bold placeholder-white/20 focus:outline-none focus:border-[#00d4aa]"
                      type="number"
                      min="0"
                      placeholder="16,000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                  <span className="text-xs text-white/40 block mb-1">You receive (after 0.3% fee)</span>
                  <span className="text-[#00d4aa] font-bold text-lg">
                    {amount ? tokenAfterFee : "0.00"} {token.symbol}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Email for payment instructions</label>
                  <input
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d4aa] text-sm"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  className="w-full bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] text-black font-bold rounded-xl py-4 disabled:opacity-40 transition-opacity"
                  disabled={busy || !amount || !email || parseFloat(amount) <= 0}
                  onClick={handleDeposit}
                >
                  {busy ? "Processing…" : `Buy ${token.symbol} →`}
                </button>
              </>
            )}

            {/* SELL TAB */}
            {activeTab === "withdraw" && (
              <>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">You sell ({token.symbol})</label>
                  <input
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-xl font-bold placeholder-white/20 focus:outline-none focus:border-[#00d4aa]"
                    type="number"
                    min="0"
                    placeholder="10"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                  <span className="text-xs text-white/40 block mb-1">You receive (after 0.3% fee)</span>
                  <span className="text-[#00d4aa] font-bold text-lg">
                    ₦{amount ? fiatAfterFee.toLocaleString() : "0"}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Bank</label>
                  <select
                    className="w-full bg-[#1a1a1a] border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00d4aa] text-sm"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                  >
                    <option value="">Select Bank</option>
                    {banks.map((b) => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Account Number</label>
                  <input
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d4aa] text-sm"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="0123456789"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  />
                  {accountName && (
                    <p className="text-[#00d4aa] text-xs mt-1.5">✓ {accountName}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Email (optional)</label>
                  <input
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d4aa] text-sm"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  className="w-full bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] text-black font-bold rounded-xl py-4 disabled:opacity-40 transition-opacity"
                  disabled={busy || !amount || !bankCode || !accountNumber || parseFloat(amount) <= 0}
                  onClick={handleWithdraw}
                >
                  {busy ? "Processing…" : `Sell ${token.symbol} →`}
                </button>
              </>
            )}

            {/* SEND TAB */}
            {activeTab === "send" && (
              <>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Token</label>
                  <select
                    className="w-full bg-[#1a1a1a] border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00d4aa] text-sm"
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                  >
                    {Object.entries(SUPPORTED_TOKENS).map(([key, t]) => (
                      <option key={key} value={key}>{t.symbol} ({key})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Recipient (Stacks address)</label>
                  <input
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none text-sm ${
                      addressValid === false
                        ? "border-red-500/60 focus:border-red-500"
                        : addressValid === true
                        ? "border-[#00d4aa]/60 focus:border-[#00d4aa]"
                        : "border-white/15 focus:border-[#00d4aa]"
                    }`}
                    type="text"
                    placeholder="ST1... or SP1..."
                    value={recipientAddress}
                    onChange={(e) => {
                      setRecipientAddress(e.target.value);
                      setErrorMsg("");
                    }}
                  />
                  {addressValid === true && (
                    <p className="text-[#00d4aa] text-xs mt-1.5">✓ Valid Stacks address</p>
                  )}
                  {addressValid === false && recipientAddress && (
                    <p className="text-red-400 text-xs mt-1.5">✗ Invalid Stacks address</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Amount ({token.symbol})</label>
                  <input
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#00d4aa] text-xl font-bold"
                    type="number"
                    min="0"
                    placeholder="5"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                {amount && parseFloat(amount) > 0 && (
                  <div className="text-xs text-white/40 space-y-0.5">
                    <div>Protocol fee: {protocolFeeDisplay} {token.symbol}</div>
                    <div>Network fee: ~0.001 STX</div>
                  </div>
                )}

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400">
                  Sends to any Stacks wallet. To cash out to Binance/OKX, use the <strong>Sell</strong> tab to receive NGN to your bank.
                </div>

                <button
                  className="w-full bg-gradient-to-r from-[#00d4aa] to-[#00b4d8] text-black font-bold rounded-xl py-4 disabled:opacity-40 transition-opacity"
                  disabled={busy || !amount || !recipientAddress || !addressValid || parseFloat(amount) <= 0}
                  onClick={handleSend}
                >
                  {busy ? "Processing…" : `Send ${token.symbol} →`}
                </button>
              </>
            )}

            {/* Tx progress steps */}
            {txSteps.length > 0 && (
              <TxStatus steps={txSteps} txId={txId} />
            )}

            {/* Success */}
            {successMsg && (
              <div className="bg-[#00d4aa]/10 border border-[#00d4aa]/30 rounded-xl p-4 text-[#00d4aa] text-sm whitespace-pre-line">
                {successMsg}
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="mt-12 text-xs text-white/20">Built on Stacks · Non-custodial · Nigeria MVP</p>
    </div>
  );
}

import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("Mock USDCx Token", () => {
  // =============================================
  // FAUCET
  // =============================================
  describe("Faucet", () => {
    it("should let anyone mint up to 10,000 tokens via faucet", () => {
      const amount = 10_000_000_000; // 10,000 USDCx (6 decimals)
      const result = simnet.callPublicFn("mock-usdcx", "faucet", [Cl.uint(amount)], wallet1);
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should reject faucet amounts above the cap (10,000 USDCx)", () => {
      const amount = 10_000_000_001; // 1 unit over cap
      const result = simnet.callPublicFn("mock-usdcx", "faucet", [Cl.uint(amount)], wallet1);
      expect(result.result).toBeErr(Cl.uint(403));
    });

    it("should increase balance after faucet", () => {
      const amount = 5_000_000; // 5 USDCx
      simnet.callPublicFn("mock-usdcx", "faucet", [Cl.uint(amount)], wallet1);
      const balResult = simnet.callReadOnlyFn("mock-usdcx", "get-balance", [Cl.principal(wallet1)], wallet1);
      expect(balResult.result).toBeOk(Cl.uint(amount));
    });
  });

  // =============================================
  // MINT (admin only)
  // =============================================
  describe("Mint (admin only)", () => {
    it("should allow deployer to mint tokens to any recipient", () => {
      const amount = 100_000_000; // 100 USDCx
      const result = simnet.callPublicFn("mock-usdcx", "mint", [Cl.uint(amount), Cl.principal(wallet2)], deployer);
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should reject mint from non-deployer", () => {
      const result = simnet.callPublicFn("mock-usdcx", "mint", [Cl.uint(1_000_000), Cl.principal(wallet2)], wallet1);
      expect(result.result).toBeErr(Cl.uint(401)); // ERR-UNAUTHORIZED
    });
  });

  // =============================================
  // TRANSFER
  // =============================================
  describe("Transfer", () => {
    it("should transfer tokens between wallets", () => {
      // Mint to wallet1 first
      simnet.callPublicFn("mock-usdcx", "mint", [Cl.uint(50_000_000), Cl.principal(wallet1)], deployer);
      const amount = 10_000_000; // 10 USDCx

      const result = simnet.callPublicFn(
        "mock-usdcx",
        "transfer",
        [Cl.uint(amount), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should reduce sender balance after transfer", () => {
      const mintAmount = 50_000_000;
      simnet.callPublicFn("mock-usdcx", "mint", [Cl.uint(mintAmount), Cl.principal(wallet1)], deployer);
      const sendAmount = 20_000_000;

      simnet.callPublicFn(
        "mock-usdcx",
        "transfer",
        [Cl.uint(sendAmount), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
        wallet1
      );

      const balResult = simnet.callReadOnlyFn("mock-usdcx", "get-balance", [Cl.principal(wallet1)], wallet1);
      expect(balResult.result).toBeOk(Cl.uint(mintAmount - sendAmount));
    });

    it("should increase recipient balance after transfer", () => {
      simnet.callPublicFn("mock-usdcx", "mint", [Cl.uint(50_000_000), Cl.principal(wallet1)], deployer);
      const sendAmount = 15_000_000;

      simnet.callPublicFn(
        "mock-usdcx",
        "transfer",
        [Cl.uint(sendAmount), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
        wallet1
      );

      const balResult = simnet.callReadOnlyFn("mock-usdcx", "get-balance", [Cl.principal(wallet2)], wallet2);
      expect(balResult.result).toBeOk(Cl.uint(sendAmount));
    });

    it("should reject transfer from non-sender (unauthorized)", () => {
      simnet.callPublicFn("mock-usdcx", "mint", [Cl.uint(50_000_000), Cl.principal(wallet1)], deployer);

      // wallet2 tries to transfer wallet1's tokens
      const result = simnet.callPublicFn(
        "mock-usdcx",
        "transfer",
        [Cl.uint(1_000_000), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(401)); // ERR-UNAUTHORIZED
    });
  });

  // =============================================
  // READ-ONLY
  // =============================================
  describe("Metadata", () => {
    it("should return correct token name", () => {
      const result = simnet.callReadOnlyFn("mock-usdcx", "get-name", [], deployer);
      expect(result.result).toBeOk(Cl.stringAscii("Mock USDCx"));
    });

    it("should return correct symbol", () => {
      const result = simnet.callReadOnlyFn("mock-usdcx", "get-symbol", [], deployer);
      expect(result.result).toBeOk(Cl.stringAscii("mUSDCx"));
    });

    it("should return 6 decimals", () => {
      const result = simnet.callReadOnlyFn("mock-usdcx", "get-decimals", [], deployer);
      expect(result.result).toBeOk(Cl.uint(6));
    });

    it("should return correct total supply after minting", () => {
      const mintAmount = 1_000_000;
      simnet.callPublicFn("mock-usdcx", "mint", [Cl.uint(mintAmount), Cl.principal(wallet1)], deployer);
      const result = simnet.callReadOnlyFn("mock-usdcx", "get-total-supply", [], deployer);
      expect(result.result).toBeOk(Cl.uint(mintAmount));
    });
  });
});

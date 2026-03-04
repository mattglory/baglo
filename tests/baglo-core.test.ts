import { describe, it, expect, beforeEach } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("Baglo Core", () => {
  // =============================================
  // SETUP - Mint tokens for testing
  // =============================================
  beforeEach(() => {
    // Mint mock USDCx to wallet_1 for testing
    simnet.callPublicFn("mock-usdcx", "mint", [Cl.uint(100_000_000_000), Cl.principal(wallet1)], deployer);
    // Mint mock USDCx to wallet_2
    simnet.callPublicFn("mock-usdcx", "mint", [Cl.uint(100_000_000_000), Cl.principal(wallet2)], deployer);
    // Fund the pool (for deposits) from deployer
    simnet.callPublicFn("mock-usdcx", "mint", [Cl.uint(500_000_000_000), Cl.principal(deployer)], deployer);
    simnet.callPublicFn("baglo-core", "fund-pool", [Cl.principal(`${deployer}.mock-usdcx`), Cl.uint(500_000_000_000)], deployer);
  });

  // =============================================
  // ADMIN TESTS
  // =============================================
  describe("Admin Functions", () => {
    it("should allow owner to add admin", () => {
      const result = simnet.callPublicFn("baglo-core", "add-admin", [Cl.principal(wallet1)], deployer);
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should reject non-owner adding admin", () => {
      const result = simnet.callPublicFn("baglo-core", "add-admin", [Cl.principal(wallet2)], wallet1);
      expect(result.result).toBeErr(Cl.uint(1000)); // ERR-UNAUTHORIZED
    });

    it("should allow owner to set protocol fee", () => {
      const result = simnet.callPublicFn("baglo-core", "set-protocol-fee", [Cl.uint(50)], deployer);
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should reject fee above 5%", () => {
      const result = simnet.callPublicFn("baglo-core", "set-protocol-fee", [Cl.uint(501)], deployer);
      expect(result.result).toBeErr(Cl.uint(1006)); // ERR-FEE-TOO-HIGH
    });

    it("should allow owner to pause contract", () => {
      const result = simnet.callPublicFn("baglo-core", "set-paused", [Cl.bool(true)], deployer);
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  // =============================================
  // WITHDRAWAL TESTS (Crypto -> Fiat)
  // =============================================
  describe("Withdrawals (Crypto -> Fiat)", () => {
    it("should create a withdrawal and lock tokens", () => {
      const amount = 10_000_000; // 10 USDCx
      const result = simnet.callPublicFn(
        "baglo-core", "create-withdrawal",
        [
          Cl.principal(`${deployer}.mock-usdcx`),
          Cl.uint(amount),
          Cl.stringAscii("NGN"),
          Cl.uint(15_000_000)
        ],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(0)); // first order id = 0
    });

    it("should allow admin to confirm withdrawal", () => {
      // Create withdrawal first
      simnet.callPublicFn(
        "baglo-core", "create-withdrawal",
        [Cl.principal(`${deployer}.mock-usdcx`), Cl.uint(10_000_000), Cl.stringAscii("NGN"), Cl.uint(15_000_000)],
        wallet1
      );
      // Add wallet3 as admin
      simnet.callPublicFn("baglo-core", "add-admin", [Cl.principal(wallet3)], deployer);
      // Confirm as admin
      const result = simnet.callPublicFn("baglo-core", "confirm-withdrawal", [Cl.uint(0)], wallet3);
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should reject non-admin confirming withdrawal", () => {
      simnet.callPublicFn(
        "baglo-core", "create-withdrawal",
        [Cl.principal(`${deployer}.mock-usdcx`), Cl.uint(10_000_000), Cl.stringAscii("NGN"), Cl.uint(15_000_000)],
        wallet1
      );
      const result = simnet.callPublicFn("baglo-core", "confirm-withdrawal", [Cl.uint(0)], wallet2);
      expect(result.result).toBeErr(Cl.uint(1000)); // ERR-UNAUTHORIZED
    });

    it("should reject zero amount withdrawal", () => {
      const result = simnet.callPublicFn(
        "baglo-core", "create-withdrawal",
        [Cl.principal(`${deployer}.mock-usdcx`), Cl.uint(0), Cl.stringAscii("NGN"), Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(1001)); // ERR-INVALID-AMOUNT
    });
  });

  // =============================================
  // DEPOSIT TESTS (Fiat -> Crypto)
  // =============================================
  describe("Deposits (Fiat -> Crypto)", () => {
    it("should create a deposit order", () => {
      const result = simnet.callPublicFn(
        "baglo-core", "create-deposit",
        [Cl.stringAscii("NGN"), Cl.uint(15_000_000), Cl.uint(10_000_000)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("should allow admin to confirm deposit (release tokens)", () => {
      // Create deposit
      simnet.callPublicFn(
        "baglo-core", "create-deposit",
        [Cl.stringAscii("NGN"), Cl.uint(15_000_000), Cl.uint(10_000_000)],
        wallet1
      );
      // Confirm deposit releases tokens from pool
      const result = simnet.callPublicFn(
        "baglo-core", "confirm-deposit",
        [Cl.uint(0), Cl.principal(`${deployer}.mock-usdcx`)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should reject non-admin confirming deposit", () => {
      simnet.callPublicFn(
        "baglo-core", "create-deposit",
        [Cl.stringAscii("NGN"), Cl.uint(15_000_000), Cl.uint(10_000_000)],
        wallet1
      );
      const result = simnet.callPublicFn(
        "baglo-core", "confirm-deposit",
        [Cl.uint(0), Cl.principal(`${deployer}.mock-usdcx`)],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(1000));
    });
  });

  // =============================================
  // CANCEL ORDER TESTS
  // =============================================
  describe("Cancel Orders", () => {
    it("should cancel a pending deposit", () => {
      simnet.callPublicFn(
        "baglo-core", "create-deposit",
        [Cl.stringAscii("NGN"), Cl.uint(15_000_000), Cl.uint(10_000_000)],
        wallet1
      );
      const result = simnet.callPublicFn(
        "baglo-core", "cancel-order",
        [Cl.uint(0), Cl.principal(`${deployer}.mock-usdcx`)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  // =============================================
  // READ-ONLY TESTS
  // =============================================
  describe("Read-Only Functions", () => {
    it("should estimate fee correctly (0.3% of 1,000,000)", () => {
      const result = simnet.callReadOnlyFn("baglo-core", "estimate-fee", [Cl.uint(1_000_000)], deployer);
      expect(result.result).toBeUint(3000); // 0.3% = 3000
    });

    it("should return protocol fee", () => {
      const result = simnet.callReadOnlyFn("baglo-core", "get-protocol-fee", [], deployer);
      expect(result.result).toBeUint(30); // 30 bps = 0.3%
    });

    it("should return order count", () => {
      const result = simnet.callReadOnlyFn("baglo-core", "get-order-count", [], deployer);
      expect(result.result).toBeUint(0);
    });

    it("should track order count after creating orders", () => {
      simnet.callPublicFn(
        "baglo-core", "create-deposit",
        [Cl.stringAscii("NGN"), Cl.uint(15_000_000), Cl.uint(10_000_000)],
        wallet1
      );
      simnet.callPublicFn(
        "baglo-core", "create-deposit",
        [Cl.stringAscii("NGN"), Cl.uint(30_000_000), Cl.uint(20_000_000)],
        wallet2
      );
      const result = simnet.callReadOnlyFn("baglo-core", "get-order-count", [], deployer);
      expect(result.result).toBeUint(2);
    });
  });

  // =============================================
  // POOL MANAGEMENT TESTS
  // =============================================
  describe("Pool Management", () => {
    it("should allow anyone to fund pool", () => {
      const result = simnet.callPublicFn(
        "baglo-core", "fund-pool",
        [Cl.principal(`${deployer}.mock-usdcx`), Cl.uint(1_000_000)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should only allow owner to drain pool", () => {
      const result = simnet.callPublicFn(
        "baglo-core", "drain-pool",
        [Cl.principal(`${deployer}.mock-usdcx`), Cl.uint(1_000_000), Cl.principal(wallet1)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(1000)); // ERR-UNAUTHORIZED
    });

    it("should allow owner to drain pool", () => {
      const result = simnet.callPublicFn(
        "baglo-core", "drain-pool",
        [Cl.principal(`${deployer}.mock-usdcx`), Cl.uint(1_000_000), Cl.principal(deployer)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  // =============================================
  // PAUSE TESTS
  // =============================================
  describe("Pause Protection", () => {
    it("should block withdrawals when paused", () => {
      simnet.callPublicFn("baglo-core", "set-paused", [Cl.bool(true)], deployer);
      const result = simnet.callPublicFn(
        "baglo-core", "create-withdrawal",
        [Cl.principal(`${deployer}.mock-usdcx`), Cl.uint(10_000_000), Cl.stringAscii("NGN"), Cl.uint(15_000_000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(1009)); // ERR-PAUSED
    });

    it("should block deposits when paused", () => {
      simnet.callPublicFn("baglo-core", "set-paused", [Cl.bool(true)], deployer);
      const result = simnet.callPublicFn(
        "baglo-core", "create-deposit",
        [Cl.stringAscii("NGN"), Cl.uint(15_000_000), Cl.uint(10_000_000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(1009));
    });
  });
});

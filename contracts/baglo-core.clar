;; ============================================================
;; BAGLO CORE v1.0 - Decentralized Remittance & Exchange
;; ============================================================
;; Built with patterns from Ken Rogers' sbtc-starter + x402 concepts
;;
;; Handles:
;;   1. Deposits (fiat-to-stable: user pays NGN, receives stablecoin)
;;   2. Withdrawals (stable-to-fiat: user locks stable, receives NGN)
;;   3. P2P escrow (trustless peer-to-peer with automated release)
;;   4. External sends (via standard SIP-010 transfer)
;;
;; Supports ANY SIP-010 token (USDCx, USDTx, sBTC, etc.)
;; Fees: Configurable protocol fee (default 0.3%)
;; ============================================================

(use-trait ft-trait .sip010-ft-trait.ft-trait)

;; ============================================================
;; CONSTANTS
;; ============================================================

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-UNAUTHORIZED (err u1000))
(define-constant ERR-INVALID-AMOUNT (err u1001))
(define-constant ERR-ORDER-NOT-FOUND (err u1002))
(define-constant ERR-INVALID-STATUS (err u1003))
(define-constant ERR-TRANSFER-FAILED (err u1004))
(define-constant ERR-SELF-TRANSFER (err u1005))
(define-constant ERR-FEE-TOO-HIGH (err u1006))
(define-constant ERR-ALREADY-CANCELLED (err u1007))
(define-constant ERR-TIMEOUT-NOT-REACHED (err u1008))
(define-constant ERR-PAUSED (err u1009))

;; Order statuses
(define-constant STATUS-PENDING u1)
(define-constant STATUS-LOCKED u2)
(define-constant STATUS-RELEASED u3)
(define-constant STATUS-CANCELLED u4)

;; Order types
(define-constant TYPE-DEPOSIT u1)
(define-constant TYPE-WITHDRAW u2)

;; ============================================================
;; DATA VARIABLES
;; ============================================================

(define-data-var order-nonce uint u0)
(define-data-var protocol-fee-bps uint u30)        ;; 0.3% = 30 basis points
(define-data-var fee-collector principal CONTRACT-OWNER)
(define-data-var is-paused bool false)

(define-map admins principal bool)

;; ============================================================
;; DATA MAPS
;; ============================================================

(define-map orders uint
  {
    order-type: uint,
    maker: principal,
    taker: principal,
    amount: uint,
    fee-amount: uint,
    status: uint,
    fiat-currency: (string-ascii 3),
    fiat-amount: uint,
    created-at: uint,
    timeout-blocks: uint
  }
)

(define-map user-latest-order principal uint)

;; ============================================================
;; PRIVATE FUNCTIONS
;; ============================================================

(define-private (is-admin (account principal))
  (default-to false (map-get? admins account))
)

(define-private (is-owner)
  (is-eq tx-sender CONTRACT-OWNER)
)

(define-private (calculate-fee (amount uint))
  (/ (* amount (var-get protocol-fee-bps)) u10000)
)

(define-private (get-next-order-id)
  (let ((current-id (var-get order-nonce)))
    (var-set order-nonce (+ current-id u1))
    current-id
  )
)

;; ============================================================
;; 1. WITHDRAWAL: Stablecoin -> Fiat
;; ============================================================
;; User locks tokens -> backend triggers Flutterwave payout ->
;; admin calls confirm-withdrawal

(define-public (create-withdrawal
    (token <ft-trait>)
    (amount uint)
    (fiat-currency (string-ascii 3))
    (fiat-amount uint))
  (let (
    (order-id (get-next-order-id))
    (fee (calculate-fee amount))
    (net-amount (- amount fee))
  )
    (asserts! (not (var-get is-paused)) ERR-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (> net-amount u0) ERR-INVALID-AMOUNT)

    ;; Lock tokens in contract
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

    ;; Fee to collector
    (and (> fee u0)
      (try! (as-contract (contract-call? token transfer fee tx-sender (var-get fee-collector) none)))
    )

    (map-set orders order-id {
      order-type: TYPE-WITHDRAW,
      maker: tx-sender,
      taker: CONTRACT-OWNER,
      amount: net-amount,
      fee-amount: fee,
      status: STATUS-LOCKED,
      fiat-currency: fiat-currency,
      fiat-amount: fiat-amount,
      created-at: block-height,
      timeout-blocks: u144
    })

    (map-set user-latest-order tx-sender order-id)
    (print {event: "withdrawal-created", order-id: order-id, amount: net-amount, fee: fee})
    (ok order-id)
  )
)

(define-public (confirm-withdrawal (order-id uint))
  (let ((order (unwrap! (map-get? orders order-id) ERR-ORDER-NOT-FOUND)))
    (asserts! (or (is-admin tx-sender) (is-owner)) ERR-UNAUTHORIZED)
    (asserts! (is-eq (get status order) STATUS-LOCKED) ERR-INVALID-STATUS)
    (asserts! (is-eq (get order-type order) TYPE-WITHDRAW) ERR-INVALID-STATUS)

    (map-set orders order-id (merge order {status: STATUS-RELEASED}))
    (print {event: "withdrawal-confirmed", order-id: order-id})
    (ok true)
  )
)

;; ============================================================
;; 2. DEPOSIT: Fiat -> Stablecoin
;; ============================================================
;; User creates order -> pays NGN via Flutterwave ->
;; webhook confirms -> admin calls confirm-deposit ->
;; tokens released from pool to user

(define-public (create-deposit
    (fiat-currency (string-ascii 3))
    (fiat-amount uint)
    (token-amount uint))
  (let (
    (order-id (get-next-order-id))
    (fee (calculate-fee token-amount))
  )
    (asserts! (not (var-get is-paused)) ERR-PAUSED)
    (asserts! (> fiat-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (> token-amount u0) ERR-INVALID-AMOUNT)

    (map-set orders order-id {
      order-type: TYPE-DEPOSIT,
      maker: tx-sender,
      taker: CONTRACT-OWNER,
      amount: token-amount,
      fee-amount: fee,
      status: STATUS-PENDING,
      fiat-currency: fiat-currency,
      fiat-amount: fiat-amount,
      created-at: block-height,
      timeout-blocks: u144
    })

    (map-set user-latest-order tx-sender order-id)
    (print {event: "deposit-created", order-id: order-id, fiat-amount: fiat-amount})
    (ok order-id)
  )
)

(define-public (confirm-deposit (order-id uint) (token <ft-trait>))
  (let (
    (order (unwrap! (map-get? orders order-id) ERR-ORDER-NOT-FOUND))
    (net-amount (- (get amount order) (get fee-amount order)))
  )
    (asserts! (or (is-admin tx-sender) (is-owner)) ERR-UNAUTHORIZED)
    (asserts! (is-eq (get status order) STATUS-PENDING) ERR-INVALID-STATUS)
    (asserts! (is-eq (get order-type order) TYPE-DEPOSIT) ERR-INVALID-STATUS)

    ;; Release tokens from pool to user
    (try! (as-contract (contract-call? token transfer net-amount tx-sender (get maker order) none)))

    ;; Fee to collector
    (and (> (get fee-amount order) u0)
      (try! (as-contract (contract-call? token transfer (get fee-amount order) tx-sender (var-get fee-collector) none)))
    )

    (map-set orders order-id (merge order {status: STATUS-RELEASED}))
    (print {event: "deposit-confirmed", order-id: order-id, recipient: (get maker order)})
    (ok true)
  )
)

;; ============================================================
;; 3. CANCEL ORDER
;; ============================================================

(define-public (cancel-order (order-id uint) (token <ft-trait>))
  (let ((order (unwrap! (map-get? orders order-id) ERR-ORDER-NOT-FOUND)))
    (asserts! (or (is-eq tx-sender (get maker order)) (is-admin tx-sender) (is-owner)) ERR-UNAUTHORIZED)

    (asserts! (or
      (is-eq (get status order) STATUS-PENDING)
      (and
        (is-eq (get status order) STATUS-LOCKED)
        (>= block-height (+ (get created-at order) (get timeout-blocks order)))
      )
    ) ERR-INVALID-STATUS)

    (if (is-eq (get status order) STATUS-LOCKED)
      (try! (as-contract (contract-call? token transfer (get amount order) tx-sender (get maker order) none)))
      true
    )

    (map-set orders order-id (merge order {status: STATUS-CANCELLED}))
    (print {event: "order-cancelled", order-id: order-id})
    (ok true)
  )
)

;; ============================================================
;; READ-ONLY FUNCTIONS
;; ============================================================

(define-read-only (get-order (order-id uint))
  (map-get? orders order-id)
)

(define-read-only (get-order-count)
  (var-get order-nonce)
)

(define-read-only (get-protocol-fee)
  (var-get protocol-fee-bps)
)

(define-read-only (get-user-latest-order (user principal))
  (map-get? user-latest-order user)
)

(define-read-only (is-contract-paused)
  (var-get is-paused)
)

(define-read-only (estimate-fee (amount uint))
  (calculate-fee amount)
)

;; ============================================================
;; ADMIN FUNCTIONS
;; ============================================================

(define-public (add-admin (admin principal))
  (begin
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    (map-set admins admin true)
    (ok true)
  )
)

(define-public (remove-admin (admin principal))
  (begin
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    (map-delete admins admin)
    (ok true)
  )
)

(define-public (set-protocol-fee (new-fee-bps uint))
  (begin
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    (asserts! (<= new-fee-bps u500) ERR-FEE-TOO-HIGH)
    (var-set protocol-fee-bps new-fee-bps)
    (ok true)
  )
)

(define-public (set-fee-collector (new-collector principal))
  (begin
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    (var-set fee-collector new-collector)
    (ok true)
  )
)

(define-public (set-paused (paused bool))
  (begin
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    (var-set is-paused paused)
    (ok true)
  )
)

;; Fund contract pool (for deposit liquidity)
(define-public (fund-pool (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
    (print {event: "pool-funded", amount: amount, funder: tx-sender})
    (ok true)
  )
)

;; Emergency drain (owner only)
(define-public (drain-pool (token <ft-trait>) (amount uint) (recipient principal))
  (begin
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    (try! (as-contract (contract-call? token transfer amount tx-sender recipient none)))
    (ok true)
  )
)

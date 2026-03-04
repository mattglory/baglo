;; Mock Stablecoin Token (for testnet)
;; Implements SIP-010 - use for testing before connecting to real USDCx/USDTx
;; Based on Ken Rogers' sbtc-starter patterns

(impl-trait .sip010-ft-trait.ft-trait)

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-UNAUTHORIZED (err u401))
(define-constant ERR-INSUFFICIENT-BALANCE (err u402))

(define-fungible-token mock-usdcx)

(define-data-var token-name (string-ascii 32) "Mock USDCx")
(define-data-var token-symbol (string-ascii 32) "mUSDCx")
(define-data-var token-uri (optional (string-utf8 256)) none)
(define-data-var token-decimals uint u6)

;; --- SIP-010 Implementation ---

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-UNAUTHORIZED)
    (try! (ft-transfer? mock-usdcx amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok (var-get token-name))
)

(define-read-only (get-symbol)
  (ok (var-get token-symbol))
)

(define-read-only (get-decimals)
  (ok (var-get token-decimals))
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance mock-usdcx account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply mock-usdcx))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; --- Testnet Only: Mint/Faucet ---

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (ft-mint? mock-usdcx amount recipient)
  )
)

(define-public (faucet (amount uint))
  (begin
    (asserts! (<= amount u10000000000) (err u403))
    (ft-mint? mock-usdcx amount tx-sender)
  )
)

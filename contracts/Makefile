# contracts/Makefile
#
# Build, test, and (future) deploy tasks for all reputation-passport Soroban
# contracts.  Intended to be the single entry-point for contract CI.
#
# Prerequisites:
#   - Rust toolchain with wasm32-unknown-unknown target
#   - soroban-cli (stellar-cli >= 28.0.0)
#   - A funded Stellar testnet account (DEPLOYER_SECRET set in environment)
#
# Usage:
#   make build          — compile all contracts to optimised WASM
#   make test           — run the full contract test suite
#   make check          — fast type-check without producing artefacts
#   make clean          — remove build artefacts
#   make deploy-testnet — deploy to Stellar testnet (requires DEPLOYER_SECRET)

CARGO        := cargo
SOROBAN      := soroban
WASM_TARGET  := wasm32-unknown-unknown
RELEASE_DIR  := target/$(WASM_TARGET)/release

# Packages that produce deployable WASM binaries.
# shared/ is a library only — it does not produce a deployable contract.
CONTRACTS    := issuer-registry attestation-registry profile-registry

# --- Phony targets -----------------------------------------------------------

.PHONY: all build test check clean deploy-testnet fmt lint help

all: build

# --- Build -------------------------------------------------------------------

## build: compile every contract to optimised WASM
build:
	$(CARGO) build \
		--target $(WASM_TARGET) \
		--release \
		$(addprefix --package ,$(CONTRACTS)) \
		--profile release
	@echo ""
	@echo "Built WASM artefacts:"
	@for c in $(CONTRACTS); do \
		name=$$(echo $$c | tr '-' '_'); \
		echo "  $(RELEASE_DIR)/$$name.wasm"; \
	done

# --- Test --------------------------------------------------------------------

## test: run the full unit-test suite for all workspace members
test:
	$(CARGO) test --workspace

## test-verbose: run tests with output for debugging
test-verbose:
	$(CARGO) test --workspace -- --nocapture

# --- Type-check (fast) -------------------------------------------------------

## check: fast type-check without producing artefacts
check:
	$(CARGO) check --workspace

# --- Format and lint ---------------------------------------------------------

## fmt: auto-format all Rust source files
fmt:
	$(CARGO) fmt --all

## lint: run Clippy across the workspace
lint:
	$(CARGO) clippy --workspace --all-targets -- -D warnings

# --- Deploy ------------------------------------------------------------------
#
# Requires DEPLOYER_SECRET to be set in the environment:
#   export DEPLOYER_SECRET=<Stellar secret key Sxxxxxxx...>
#
# Testnet contract IDs are printed to stdout and written to
# .testnet-contract-ids for use by the SDK/backend.

## deploy-testnet: build and deploy all contracts to Stellar testnet
deploy-testnet: build
	@if [ -z "$$DEPLOYER_SECRET" ]; then \
		echo "ERROR: DEPLOYER_SECRET is not set. Export your testnet secret key."; \
		exit 1; \
	fi
	@echo "Deploying contracts to Stellar testnet..."
	@rm -f .testnet-contract-ids
	@for c in $(CONTRACTS); do \
		name=$$(echo $$c | tr '-' '_'); \
		wasm="$(RELEASE_DIR)/$$name.wasm"; \
		echo "Deploying $$c from $$wasm ..."; \
		contract_id=$$($(SOROBAN) contract deploy \
			--wasm $$wasm \
			--source $$DEPLOYER_SECRET \
			--network testnet); \
		echo "  $$c = $$contract_id"; \
		echo "$$c=$$contract_id" >> .testnet-contract-ids; \
	done
	@echo ""
	@echo "Contract IDs written to .testnet-contract-ids"

# --- Clean -------------------------------------------------------------------

## clean: remove all build artefacts
clean:
	$(CARGO) clean

# --- Help --------------------------------------------------------------------

## help: list available make targets with descriptions
help:
	@echo "Available targets:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /' | column -t -s ':'

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
# Also requires DEPLOYER_ADDRESS (the public key matching DEPLOYER_SECRET) and
# ADMIN_ADDRESS (the Stellar address to set as contract admin).
# If ADMIN_ADDRESS is not set it defaults to DEPLOYER_ADDRESS.
#
# Testnet contract IDs are printed to stdout and written to
# .testnet-contract-ids for use by the SDK/backend.

## deploy-testnet: build and deploy all contracts to Stellar testnet, then initialise them
deploy-testnet: build
	@if [ -z "$$DEPLOYER_SECRET" ]; then \
		echo "ERROR: DEPLOYER_SECRET is not set. Export your testnet secret key."; \
		exit 1; \
	fi
	@if [ -z "$$DEPLOYER_ADDRESS" ]; then \
		echo "ERROR: DEPLOYER_ADDRESS is not set. Export the public key matching DEPLOYER_SECRET."; \
		exit 1; \
	fi
	@ADMIN=$${ADMIN_ADDRESS:-$$DEPLOYER_ADDRESS}; \
	echo "Deploying contracts to Stellar testnet (admin: $$ADMIN)..."; \
	rm -f .testnet-contract-ids; \
	echo "--- Deploying issuer-registry ---"; \
	IR_ID=$$($(SOROBAN) contract deploy \
		--wasm $(RELEASE_DIR)/issuer_registry.wasm \
		--source $$DEPLOYER_SECRET \
		--network testnet); \
	echo "  issuer-registry = $$IR_ID"; \
	echo "issuer-registry=$$IR_ID" >> .testnet-contract-ids; \
	$(SOROBAN) contract invoke \
		--id $$IR_ID --source $$DEPLOYER_SECRET --network testnet \
		-- initialize --admin $$ADMIN --min_stake 100; \
	echo "  issuer-registry initialised"; \
	echo "--- Deploying attestation-registry ---"; \
	AR_ID=$$($(SOROBAN) contract deploy \
		--wasm $(RELEASE_DIR)/attestation_registry.wasm \
		--source $$DEPLOYER_SECRET \
		--network testnet); \
	echo "  attestation-registry = $$AR_ID"; \
	echo "attestation-registry=$$AR_ID" >> .testnet-contract-ids; \
	$(SOROBAN) contract invoke \
		--id $$AR_ID --source $$DEPLOYER_SECRET --network testnet \
		-- initialize --issuer_registry $$IR_ID; \
	echo "  attestation-registry initialised"; \
	echo "--- Deploying profile-registry ---"; \
	PR_ID=$$($(SOROBAN) contract deploy \
		--wasm $(RELEASE_DIR)/profile_registry.wasm \
		--source $$DEPLOYER_SECRET \
		--network testnet); \
	echo "  profile-registry = $$PR_ID"; \
	echo "profile-registry=$$PR_ID" >> .testnet-contract-ids; \
	$(SOROBAN) contract invoke \
		--id $$PR_ID --source $$DEPLOYER_SECRET --network testnet \
		-- initialize --admin $$ADMIN; \
	echo "  profile-registry initialised"; \
	echo ""; \
	echo "All contracts deployed and initialised. IDs written to .testnet-contract-ids"

# --- Clean -------------------------------------------------------------------

## clean: remove all build artefacts
clean:
	$(CARGO) clean

# --- Help --------------------------------------------------------------------

## help: list available make targets with descriptions
help:
	@echo "Available targets:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /' | column -t -s ':'

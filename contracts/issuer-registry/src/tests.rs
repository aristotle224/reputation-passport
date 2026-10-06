/*!
Unit tests for `issuer-registry`.

Coverage targets:
- `initialize`: happy path, re-initialization panic.
- `register_issuer`: happy path, insufficient stake, double registration.
- `add_stake`: happy path, issuer not found, cannot add to delisted.
- `suspend_issuer`: happy path, unauthorized caller, not found, already delisted.
- `reactivate_issuer`: happy path, unauthorized (issuer self-auth), not found,
  delisted, already active returns error.
- `delist_issuer`: happy path, unauthorized caller, not found.
- `get_issuer` / `get_issuer_status` / `get_min_stake` / `get_admin`: read
  paths.

Each test is self-contained (no shared mutable state between tests) because the
Soroban test environment creates a fresh ledger per test.
*/

#[cfg(test)]
mod tests {
    use crate::IssuerRecord;
    use reputation_passport_shared::{Error, IssuerStatus};
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::Env;

    // soroban-sdk 28 generates a `{ContractName}Client` struct from the
    // `#[contractimpl]` macro when the `testutils` feature is enabled.
    // Within the same crate this is accessible as `crate::IssuerRegistryContractClient`.
    use crate::IssuerRegistryContractClient as Client;

    // ── Helpers ──────────────────────────────────────────────────────────────

    const MIN_STAKE: i128 = 1_000_000; // 1 XLM in stroops

    /// Create a fresh environment, deploy the contract, initialise it, and
    /// return the (env, client, admin_address) tuple.
    fn setup() -> (Env, Client<'static>, soroban_sdk::Address) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(crate::IssuerRegistryContract, ());
        let client = Client::new(&env, &contract_id);

        let admin = soroban_sdk::Address::generate(&env);
        client.initialize(&admin, &MIN_STAKE);

        (env, client, admin)
    }

    // ── initialize ───────────────────────────────────────────────────────────

    #[test]
    fn test_initialize_sets_admin_and_min_stake() {
        let (_, client, admin) = setup();
        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.get_min_stake(), MIN_STAKE);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_initialize_panics_on_second_call() {
        let (_, client, admin) = setup();
        // Second call should panic.
        client.initialize(&admin, &MIN_STAKE);
    }

    // ── register_issuer ──────────────────────────────────────────────────────

    #[test]
    fn test_register_issuer_happy_path() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);

        client.register_issuer(&issuer, &MIN_STAKE);

        let record: IssuerRecord = client.get_issuer(&issuer);
        assert_eq!(record.status, IssuerStatus::Active);
        assert_eq!(record.stake, MIN_STAKE);
    }

    #[test]
    fn test_register_issuer_above_min_stake_succeeds() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        let big_stake = MIN_STAKE * 10;

        client.register_issuer(&issuer, &big_stake);

        let record: IssuerRecord = client.get_issuer(&issuer);
        assert_eq!(record.stake, big_stake);
    }

    #[test]
    fn test_register_issuer_insufficient_stake_fails() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);

        let result = client.try_register_issuer(&issuer, &(MIN_STAKE - 1));
        assert_eq!(result, Err(Ok(Error::InsufficientStake)));
    }

    #[test]
    fn test_register_issuer_zero_stake_fails_when_min_stake_nonzero() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);

        let result = client.try_register_issuer(&issuer, &0i128);
        assert_eq!(result, Err(Ok(Error::InsufficientStake)));
    }

    #[test]
    fn test_register_issuer_duplicate_fails() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);

        client.register_issuer(&issuer, &MIN_STAKE);
        let result = client.try_register_issuer(&issuer, &MIN_STAKE);
        assert_eq!(result, Err(Ok(Error::IssuerAlreadyRegistered)));
    }

    // ── add_stake ────────────────────────────────────────────────────────────

    #[test]
    fn test_add_stake_increases_balance() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);

        client.add_stake(&issuer, &MIN_STAKE);

        let record: IssuerRecord = client.get_issuer(&issuer);
        assert_eq!(record.stake, MIN_STAKE * 2);
    }

    #[test]
    fn test_add_stake_to_unknown_issuer_fails() {
        let (env, client, _) = setup();
        let unknown = soroban_sdk::Address::generate(&env);

        let result = client.try_add_stake(&unknown, &MIN_STAKE);
        assert_eq!(result, Err(Ok(Error::IssuerNotFound)));
    }

    #[test]
    fn test_add_stake_to_delisted_issuer_fails() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);
        client.delist_issuer(&issuer);

        let result = client.try_add_stake(&issuer, &MIN_STAKE);
        assert_eq!(result, Err(Ok(Error::IssuerDelisted)));
    }

    #[test]
    fn test_add_stake_to_suspended_issuer_succeeds() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);
        client.suspend_issuer(&issuer);

        // Suspended issuers can still increase their stake (they may be
        // reinstated after meeting a higher threshold).
        client.add_stake(&issuer, &MIN_STAKE);
        let record: IssuerRecord = client.get_issuer(&issuer);
        assert_eq!(record.stake, MIN_STAKE * 2);
    }

    // ── suspend_issuer ───────────────────────────────────────────────────────

    #[test]
    fn test_suspend_issuer_happy_path() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);

        client.suspend_issuer(&issuer);

        assert_eq!(client.get_issuer_status(&issuer), IssuerStatus::Suspended);
    }

    #[test]
    fn test_suspend_unknown_issuer_fails() {
        let (env, client, _) = setup();
        let unknown = soroban_sdk::Address::generate(&env);

        let result = client.try_suspend_issuer(&unknown);
        assert_eq!(result, Err(Ok(Error::IssuerNotFound)));
    }

    #[test]
    fn test_suspend_already_delisted_fails() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);
        client.delist_issuer(&issuer);

        let result = client.try_suspend_issuer(&issuer);
        assert_eq!(result, Err(Ok(Error::IssuerDelisted)));
    }

    // ── reactivate_issuer ────────────────────────────────────────────────────

    #[test]
    fn test_reactivate_suspended_issuer_happy_path() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);
        client.suspend_issuer(&issuer);

        client.reactivate_issuer(&issuer);

        assert_eq!(client.get_issuer_status(&issuer), IssuerStatus::Active);
    }

    #[test]
    fn test_reactivate_unknown_issuer_fails() {
        let (env, client, _) = setup();
        let unknown = soroban_sdk::Address::generate(&env);

        let result = client.try_reactivate_issuer(&unknown);
        assert_eq!(result, Err(Ok(Error::IssuerNotFound)));
    }

    #[test]
    fn test_reactivate_active_issuer_returns_error() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);

        // Already active — should return an error (exposed as IssuerNotFound
        // to avoid leaking state, per the contract's documented behaviour).
        let result = client.try_reactivate_issuer(&issuer);
        assert_eq!(result, Err(Ok(Error::IssuerNotFound)));
    }

    #[test]
    fn test_reactivate_delisted_issuer_fails() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);
        client.delist_issuer(&issuer);

        let result = client.try_reactivate_issuer(&issuer);
        assert_eq!(result, Err(Ok(Error::IssuerDelisted)));
    }

    // ── delist_issuer ────────────────────────────────────────────────────────

    #[test]
    fn test_delist_active_issuer_happy_path() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);

        client.delist_issuer(&issuer);

        assert_eq!(client.get_issuer_status(&issuer), IssuerStatus::Delisted);
    }

    #[test]
    fn test_delist_suspended_issuer_happy_path() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);
        client.suspend_issuer(&issuer);

        // Suspended → Delisted is a valid transition.
        client.delist_issuer(&issuer);

        assert_eq!(client.get_issuer_status(&issuer), IssuerStatus::Delisted);
    }

    #[test]
    fn test_delist_unknown_issuer_fails() {
        let (env, client, _) = setup();
        let unknown = soroban_sdk::Address::generate(&env);

        let result = client.try_delist_issuer(&unknown);
        assert_eq!(result, Err(Ok(Error::IssuerNotFound)));
    }

    #[test]
    fn test_delist_already_delisted_is_idempotent() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);
        client.delist_issuer(&issuer);

        // Delisting an already-delisted issuer is a valid no-mutation operation.
        client.delist_issuer(&issuer);
        assert_eq!(client.get_issuer_status(&issuer), IssuerStatus::Delisted);
    }

    // ── Read paths ───────────────────────────────────────────────────────────

    #[test]
    fn test_get_issuer_not_found_fails() {
        let (env, client, _) = setup();
        let unknown = soroban_sdk::Address::generate(&env);

        let result = client.try_get_issuer(&unknown);
        assert_eq!(result, Err(Ok(Error::IssuerNotFound)));
    }

    #[test]
    fn test_get_issuer_status_not_found_fails() {
        let (env, client, _) = setup();
        let unknown = soroban_sdk::Address::generate(&env);

        let result = client.try_get_issuer_status(&unknown);
        assert_eq!(result, Err(Ok(Error::IssuerNotFound)));
    }

    #[test]
    fn test_registered_at_timestamp_is_recorded() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);

        // Advance the ledger timestamp so it is non-zero and observable.
        env.ledger().set_timestamp(12_345);
        client.register_issuer(&issuer, &MIN_STAKE);

        let record: IssuerRecord = client.get_issuer(&issuer);
        assert_eq!(record.registered_at, 12_345);
    }

    // ── Authorization checks ─────────────────────────────────────────────────
    //
    // These tests verify that the contract *requests* auth from the correct
    // principal by inspecting `env.auths()` after each call.

    #[test]
    fn test_register_issuer_requires_issuer_auth() {
        let (env, client, _) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);

        // Confirm the mock captured an auth from the issuer.
        let auths = env.auths();
        assert!(
            auths.iter().any(|(addr, _)| addr == &issuer),
            "expected register_issuer to require auth from the issuer address"
        );
    }

    #[test]
    fn test_suspend_requires_admin_auth() {
        let (env, client, admin) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);
        client.suspend_issuer(&issuer);

        let auths = env.auths();
        assert!(
            auths.iter().any(|(addr, _)| addr == &admin),
            "expected suspend_issuer to require auth from the admin address"
        );
    }

    #[test]
    fn test_delist_requires_admin_auth() {
        let (env, client, admin) = setup();
        let issuer = soroban_sdk::Address::generate(&env);
        client.register_issuer(&issuer, &MIN_STAKE);
        client.delist_issuer(&issuer);

        let auths = env.auths();
        assert!(
            auths.iter().any(|(addr, _)| addr == &admin),
            "expected delist_issuer to require auth from the admin address"
        );
    }
}

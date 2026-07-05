#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, String, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Payment {
    pub id: u64,
    pub customer: Address,
    pub vendor: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub memo: String,
}

#[contracttype]
pub enum DataKey {
    Payment(u64),
    VendorPayments(Address),
    CustomerPayments(Address),
}

#[contracttype]
pub struct PaymentCompletedEvent {
    pub payment_id: u64,
    pub customer: Address,
    pub vendor: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[contracttype]
pub struct TokenChangedEvent {
    pub old_token: Address,
    pub new_token: Address,
}

#[contracttype]
pub struct UpgradedEvent {
    pub new_wasm_hash: BytesN<32>,
}

#[contract]
pub struct PalengkePayment;

#[contractimpl]
impl PalengkePayment {
    pub fn initialize(env: Env, admin: Address, fee_bps: u32, native_token: Address) {
        if env.storage().instance().has(&symbol_short!("ADMIN")) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage()
            .instance()
            .set(&symbol_short!("ADMIN"), &admin);
        env.storage()
            .instance()
            .set(&symbol_short!("FEEBPS"), &fee_bps);
        env.storage()
            .instance()
            .set(&symbol_short!("TOKEN"), &native_token);
        env.storage()
            .instance()
            .set(&symbol_short!("PAYCNT"), &0u64);
    }

    pub fn pay(env: Env, customer: Address, vendor: Address, amount: i128, memo: String) -> u64 {
        customer.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let native_token: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("TOKEN"))
            .expect("not initialized");

        token::Client::new(&env, &native_token).transfer(&customer, &vendor, &amount);

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&symbol_short!("PAYCNT"))
            .unwrap_or(0);
        count += 1;
        env.storage()
            .instance()
            .set(&symbol_short!("PAYCNT"), &count);

        let payment = Payment {
            id: count,
            customer: customer.clone(),
            vendor: vendor.clone(),
            amount,
            timestamp: env.ledger().timestamp(),
            memo: memo.clone(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Payment(count), &payment);

        let mut vendor_payments: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::VendorPayments(vendor.clone()))
            .unwrap_or(Vec::new(&env));
        vendor_payments.push_back(count);
        env.storage()
            .persistent()
            .set(&DataKey::VendorPayments(vendor.clone()), &vendor_payments);

        let mut customer_payments: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::CustomerPayments(customer.clone()))
            .unwrap_or(Vec::new(&env));
        customer_payments.push_back(count);
        env.storage().persistent().set(
            &DataKey::CustomerPayments(customer.clone()),
            &customer_payments,
        );

        env.events().publish(
            (symbol_short!("payment"), symbol_short!("done")),
            PaymentCompletedEvent {
                payment_id: count,
                customer,
                vendor,
                amount,
                timestamp: env.ledger().timestamp(),
            },
        );

        count
    }

    pub fn get_payment(env: Env, payment_id: u64) -> Payment {
        env.storage()
            .persistent()
            .get(&DataKey::Payment(payment_id))
            .expect("payment not found")
    }

    pub fn get_vendor_payments(env: Env, vendor: Address, limit: u32, offset: u32) -> Vec<Payment> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::VendorPayments(vendor))
            .unwrap_or(Vec::new(&env));

        let mut result = Vec::new(&env);
        let start = offset as usize;
        let end = (offset + limit) as usize;

        for i in start..end.min(ids.len() as usize) {
            if let Some(id) = ids.get(i as u32) {
                if let Some(p) = env.storage().persistent().get(&DataKey::Payment(id)) {
                    result.push_back(p);
                }
            }
        }
        result
    }

    pub fn get_customer_payments(
        env: Env,
        customer: Address,
        limit: u32,
        offset: u32,
    ) -> Vec<Payment> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::CustomerPayments(customer))
            .unwrap_or(Vec::new(&env));

        let mut result = Vec::new(&env);
        let start = offset as usize;
        let end = (offset + limit) as usize;

        for i in start..end.min(ids.len() as usize) {
            if let Some(id) = ids.get(i as u32) {
                if let Some(p) = env.storage().persistent().get(&DataKey::Payment(id)) {
                    result.push_back(p);
                }
            }
        }
        result
    }

    pub fn payment_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&symbol_short!("PAYCNT"))
            .unwrap_or(0)
    }

    pub fn token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("TOKEN"))
            .expect("not initialized")
    }

    /// Admin swaps the settlement token. Stateless w.r.t. in-flight payments
    /// (each `pay` is atomic; no escrow held). Safe to swap any time.
    pub fn set_token(env: Env, admin: Address, new_token: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("ADMIN"))
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }
        let old_token: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("TOKEN"))
            .expect("not initialized");
        env.storage()
            .instance()
            .set(&symbol_short!("TOKEN"), &new_token);
        env.events().publish(
            (symbol_short!("payment"), symbol_short!("settoken")),
            TokenChangedEvent {
                old_token,
                new_token,
            },
        );
    }

    /// Admin swaps the contract's executable WASM. Preserves storage.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("ADMIN"))
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }
        env.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());
        env.events().publish(
            (symbol_short!("payment"), symbol_short!("upgrade")),
            UpgradedEvent { new_wasm_hash },
        );
    }
}

#[cfg(test)]
mod test;

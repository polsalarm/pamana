use soroban_sdk::{contracterror, contracttype, Address};

/// A designated heir with a basis-point share of the vault.
/// All heirs' `bps` must sum to exactly 10_000 (= 100%).
#[contracttype]
#[derive(Clone)]
pub struct Heir {
    pub addr: Address,
    pub bps: u32,
    pub claimed: bool,
}

/// High-level vault state, legible to a non-crypto UI.
#[contracttype]
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum VaultStatus {
    /// Owner still checking in — countdown active.
    Alive,
    /// Timeout passed, no heir has claimed yet.
    TimedOut,
    /// First claim taken — TotalLocked snapshot locked in.
    Distributing,
}

#[contracttype]
pub enum DataKey {
    Owner,
    Token,
    LastHeartbeat,
    Timeout,
    Heirs,
    TotalLocked,
    Distributing,
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    /// Heir bps do not sum to exactly 10_000.
    InvalidBps = 3,
    /// Owner is still active — timeout not reached.
    OwnerStillActive = 4,
    HeirNotFound = 5,
    AlreadyClaimed = 6,
    /// Deposit / withdraw amount must be positive.
    InvalidAmount = 7,
    /// Owner cannot withdraw once distribution has begun.
    Distributing = 8,
    /// No heirs designated yet.
    NoHeirs = 9,
}

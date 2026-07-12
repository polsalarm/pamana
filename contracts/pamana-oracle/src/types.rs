use soroban_sdk::{contracterror, contracttype, Address, BytesN};

/// A signed valuation of a real-world asset. Value is in whole PHP (the RWA's
/// attested worth); `doc_hash` is the sha256 of the off-chain signed appraisal
/// document, binding this on-chain figure to a specific attested paper.
#[contracttype]
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Attestation {
    /// Attested value in whole Philippine pesos.
    pub value_php: i128,
    /// sha256 of the signed appraisal document.
    pub doc_hash: BytesN<32>,
    /// The appraiser who signed this attestation.
    pub appraiser: Address,
    /// Ledger timestamp (seconds) of the attestation.
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    /// Address — contract admin (manages the appraiser set).
    Admin,
    /// Vec<Address> — appraisers authorized to attest.
    Appraisers,
    /// Attestation — latest valuation, keyed by the asset's SAC address.
    Attestation(Address),
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    /// Caller is not a registered appraiser.
    NotAppraiser = 3,
    /// Attested value must be positive.
    InvalidValue = 4,
    /// No attestation exists for the requested asset.
    NoAttestation = 5,
    /// Appraiser is already registered.
    AlreadyAppraiser = 6,
}

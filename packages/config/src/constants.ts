/**
 * XBridge protocol constants
 */

/** Default quorum for 3 witnesses */
export const DEFAULT_QUORUM = 2;

/** Maximum witnesses supported */
export const MAX_WITNESSES = 10;

/** Minimum witnesses for production */
export const MIN_WITNESSES_PRODUCTION = 3;

/** Default signer weight per witness */
export const DEFAULT_SIGNER_WEIGHT = 1;

/** Default transaction fee in drops */
export const DEFAULT_FEE = "12";

/** Minimum lock amount in drops (to cover reserves + fees on destination) */
export const MIN_LOCK_AMOUNT = "1000000"; // 1 XRP/XAH

/** Prefix for attestation messages (prevents cross-protocol replay) */
export const ATTESTATION_PREFIX = "XBRIDGE_ATTEST_V1";

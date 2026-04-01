/**
 * XBridge constants
 */

/** XChainBridge amendment hash — must be enabled on both chains */
export const XCHAIN_BRIDGE_AMENDMENT =
  "C4483A1896170C66C098DEA5B0E024309C60DC960DE5F01CD7AF986AA3D9AD37";

/** Default signature reward paid to witnesses per attestation (in drops) */
export const DEFAULT_SIGNATURE_REWARD = "100";

/** Default minimum amount for cross-chain account creation (in drops) */
export const DEFAULT_MIN_ACCOUNT_CREATE = "10000000"; // 10 XRP/XAH

/** Maximum witnesses supported */
export const MAX_WITNESSES = 10;

/** Minimum witnesses for production */
export const MIN_WITNESSES_PRODUCTION = 3;

/** Default quorum for 3 witnesses */
export const DEFAULT_QUORUM = 2;

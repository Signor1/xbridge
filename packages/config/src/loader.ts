/**
 * Load and validate bridge configuration from JSON files
 */

import type { BridgeConfig } from "./types";
import type { NetworkEnv } from "./chains";
import { validateBridgeConfig } from "./validation";

// Import bridge configs statically so they work in bundled environments (Next.js)
import testnetConfig from "../bridges/testnet.json";
import mainnetConfig from "../bridges/mainnet.json";

const configs: Record<NetworkEnv, BridgeConfig> = {
  testnet: testnetConfig as unknown as BridgeConfig,
  mainnet: mainnetConfig as unknown as BridgeConfig,
};

/**
 * Load bridge config for a network environment.
 * Throws if the config is invalid or incomplete.
 */
export function loadBridgeConfig(env: NetworkEnv): BridgeConfig {
  const config = configs[env];
  if (!config) {
    throw new Error(`No bridge config found for env: ${env}`);
  }
  return config;
}

/**
 * Load bridge config with validation.
 * Returns errors instead of throwing — useful for UI display.
 */
export function loadAndValidateBridgeConfig(
  env: NetworkEnv,
): { config: BridgeConfig; errors: string[] } {
  const config = loadBridgeConfig(env);
  const errors = validateBridgeConfig(config);
  return { config, errors };
}

/**
 * Check if bridge is fully configured and ready to use
 */
export function isBridgeReady(env: NetworkEnv): boolean {
  const { errors } = loadAndValidateBridgeConfig(env);
  return errors.length === 0;
}

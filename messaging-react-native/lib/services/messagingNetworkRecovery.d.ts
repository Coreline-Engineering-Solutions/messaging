type NetworkRecoveryListener = () => void;
/**
 * Invokes `listener` when the app returns to the foreground or network connectivity
 * is restored. Debounced to avoid duplicate recovery bursts.
 */
export declare function subscribeMessagingNetworkRecovery(listener: NetworkRecoveryListener): () => void;
export {};
//# sourceMappingURL=messagingNetworkRecovery.d.ts.map
import { AppState, type AppStateStatus } from 'react-native';

type NetworkRecoveryListener = () => void;

type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
};

function isNetworkOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function trySubscribeNetInfo(listener: NetworkRecoveryListener): (() => void) | null {
  try {
    const NetInfo = require('@react-native-community/netinfo').default as {
      addEventListener: (cb: (state: NetInfoState) => void) => () => void;
      fetch: () => Promise<NetInfoState>;
    };

    let wasOnline = false;
    void NetInfo.fetch().then((state) => {
      wasOnline = isNetworkOnline(state);
    });

    return NetInfo.addEventListener((state) => {
      const online = isNetworkOnline(state);
      if (online && !wasOnline) listener();
      wasOnline = online;
    });
  } catch {
    return null;
  }
}

/**
 * Invokes `listener` when the app returns to the foreground or network connectivity
 * is restored. Debounced to avoid duplicate recovery bursts.
 */
export function subscribeMessagingNetworkRecovery(listener: NetworkRecoveryListener): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      listener();
    }, 400);
  };

  let appState: AppStateStatus = AppState.currentState;
  const appSub = AppState.addEventListener('change', (next) => {
    if (appState.match(/inactive|background/) && next === 'active') {
      schedule();
    }
    appState = next;
  });

  const netUnsub = trySubscribeNetInfo(schedule);

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    appSub.remove();
    netUnsub?.();
  };
}

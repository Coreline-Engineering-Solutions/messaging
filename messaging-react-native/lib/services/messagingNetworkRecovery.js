"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeMessagingNetworkRecovery = subscribeMessagingNetworkRecovery;
const react_native_1 = require("react-native");
function isNetworkOnline(state) {
    return state.isConnected === true && state.isInternetReachable !== false;
}
function trySubscribeNetInfo(listener) {
    try {
        const NetInfo = require('@react-native-community/netinfo').default;
        let wasOnline = false;
        void NetInfo.fetch().then((state) => {
            wasOnline = isNetworkOnline(state);
        });
        return NetInfo.addEventListener((state) => {
            const online = isNetworkOnline(state);
            if (online && !wasOnline)
                listener();
            wasOnline = online;
        });
    }
    catch {
        return null;
    }
}
/**
 * Invokes `listener` when the app returns to the foreground or network connectivity
 * is restored. Debounced to avoid duplicate recovery bursts.
 */
function subscribeMessagingNetworkRecovery(listener) {
    let debounceTimer = null;
    const schedule = () => {
        if (debounceTimer)
            clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            listener();
        }, 400);
    };
    let appState = react_native_1.AppState.currentState;
    const appSub = react_native_1.AppState.addEventListener('change', (next) => {
        if (appState.match(/inactive|background/) && next === 'active') {
            schedule();
        }
        appState = next;
    });
    const netUnsub = trySubscribeNetInfo(schedule);
    return () => {
        if (debounceTimer)
            clearTimeout(debounceTimer);
        appSub.remove();
        netUnsub?.();
    };
}

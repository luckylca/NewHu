import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useNetworkStore, type NetworkStatus } from '@/src/stores/useNetworkStore';

let unsubscribe: (() => void) | null = null;

function classify(state: NetInfoState): NetworkStatus {
    if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
    if (state.isConnected === true) return 'online';
    return 'unknown';
}

function update(state: NetInfoState) {
    useNetworkStore.getState().setNetwork({
        status: classify(state),
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
    });
}

export async function refreshNetworkState() {
    update(await NetInfo.fetch());
    return useNetworkStore.getState();
}

export function startNetworkMonitoring() {
    if (unsubscribe) return unsubscribe;
    unsubscribe = NetInfo.addEventListener(update);
    void refreshNetworkState();
    return () => {
        unsubscribe?.();
        unsubscribe = null;
    };
}

export function isOnline() {
    return useNetworkStore.getState().status === 'online';
}

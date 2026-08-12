import { create } from 'zustand';

export type NetworkStatus = 'unknown' | 'online' | 'offline';

type NetworkState = {
    status: NetworkStatus;
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    setNetwork: (value: { status: NetworkStatus; isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
};

export const useNetworkStore = create<NetworkState>((set) => ({
    status: 'unknown',
    isConnected: null,
    isInternetReachable: null,
    setNetwork: (value) => set(value),
}));

export const getNetworkStatus = () => useNetworkStore.getState().status;

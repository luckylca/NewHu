import { createSecureZustandStorage } from '@/src/services/secureZustandStorage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AiAnalysisSettingsState {
    enabled: boolean;
    setEnabled: (enabled: boolean) => void;
    baseUrl: string;
    setBaseUrl: (baseUrl: string) => void;
    apiKey: string;
    setApiKey: (apiKey: string) => void;
    model: string;
    setModel: (model: string) => void;
}

export const useAiAnalysisStore = create<AiAnalysisSettingsState>()(
    persist(
        (set) => ({
            enabled: false,
            setEnabled: (enabled) => set({ enabled }),
            baseUrl: '',
            setBaseUrl: (baseUrl) => set({ baseUrl }),
            apiKey: '',
            setApiKey: (apiKey) => set({ apiKey }),
            model: '',
            setModel: (model) => set({ model }),
        }),
        {
            name: 'ai-analysis-store',
            storage: createJSONStorage(() => createSecureZustandStorage(
                'ai-analysis-store',
                'apiKey',
                'newhu.ai-analysis.api-key',
            )),
            version: 1,
        },
    ),
);

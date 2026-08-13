import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    CURRENT_ONBOARDING_VERSION,
    CURRENT_PRIVACY_VERSION,
    CURRENT_TERMS_VERSION,
} from '@/src/constants/consent';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ConsentState {
    onboardingCompleted: boolean;
    onboardingVersion: number;
    privacyPolicyVersion: string;
    privacyPolicyAcceptedAt: number | null;
    termsVersion: string;
    termsAcceptedAt: number | null;
    aiInterestAnalysisEnabled: boolean;
    acceptRequiredAgreements: () => void;
    setAiInterestAnalysisEnabled: (enabled: boolean) => void;
    completeOnboarding: () => void;
}

export const useConsentStore = create<ConsentState>()(
    persist(
        (set, get) => ({
            onboardingCompleted: false,
            onboardingVersion: 0,
            privacyPolicyVersion: '',
            privacyPolicyAcceptedAt: null,
            termsVersion: '',
            termsAcceptedAt: null,
            aiInterestAnalysisEnabled: false,
            acceptRequiredAgreements: () => {
                const now = Date.now();
                set({
                    privacyPolicyVersion: CURRENT_PRIVACY_VERSION,
                    privacyPolicyAcceptedAt: now,
                    termsVersion: CURRENT_TERMS_VERSION,
                    termsAcceptedAt: now,
                });
            },
            setAiInterestAnalysisEnabled: (enabled) => set({ aiInterestAnalysisEnabled: enabled }),
            completeOnboarding: () => {
                const state = get();
                const accepted =
                    state.privacyPolicyVersion === CURRENT_PRIVACY_VERSION &&
                    state.privacyPolicyAcceptedAt != null &&
                    state.termsVersion === CURRENT_TERMS_VERSION &&
                    state.termsAcceptedAt != null;
                if (!accepted) return;
                set({
                    onboardingCompleted: true,
                    onboardingVersion: CURRENT_ONBOARDING_VERSION,
                });
            },
        }),
        {
            name: 'consent-store',
            version: 1,
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                onboardingCompleted: state.onboardingCompleted,
                onboardingVersion: state.onboardingVersion,
                privacyPolicyVersion: state.privacyPolicyVersion,
                privacyPolicyAcceptedAt: state.privacyPolicyAcceptedAt,
                termsVersion: state.termsVersion,
                termsAcceptedAt: state.termsAcceptedAt,
                aiInterestAnalysisEnabled: state.aiInterestAnalysisEnabled,
            }),
        },
    ),
);

export function hasCurrentRequiredConsent(state: ConsentState) {
    return state.onboardingCompleted &&
        state.onboardingVersion >= CURRENT_ONBOARDING_VERSION &&
        state.privacyPolicyVersion === CURRENT_PRIVACY_VERSION &&
        state.privacyPolicyAcceptedAt != null &&
        state.termsVersion === CURRENT_TERMS_VERSION &&
        state.termsAcceptedAt != null;
}


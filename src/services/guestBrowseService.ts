import { fetchAndroidRecommendPage, type AndroidRecommendationPage } from '@/src/services/androidRecommendService';

/** Guest feed always omits Cookie, even if the shared API singleton has stale auth state. */
export function fetchGuestRecommendPage(cursor = ''): Promise<AndroidRecommendationPage> {
    return fetchAndroidRecommendPage(cursor, { anonymous: true });
}

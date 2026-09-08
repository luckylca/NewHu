import { clearInterestProfile } from '@/src/db/repositories/userEventRepository';
import { resetProductV1FeedbackMemory } from './feedback';
import { resetProductV1Runtime, runProductV1Maintenance } from './runtime';

export function clearProductV1Personalization() {
  return runProductV1Maintenance(async () => {
    await clearInterestProfile();
    resetProductV1Runtime();
    resetProductV1FeedbackMemory();
  });
}

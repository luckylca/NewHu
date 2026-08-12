import { resolveImageUri } from './resourceService';

export { extractImageUrls } from './resourceService';

export async function resolveImageSource(remoteUrl: string, online: boolean) {
    const uri = await resolveImageUri(remoteUrl, online);
    return uri ? { uri } : null;
}

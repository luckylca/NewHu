const { withAndroidManifest } = require('@expo/config-plugins');

const LEGACY_STORAGE_PERMISSIONS = new Set([
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.MANAGE_EXTERNAL_STORAGE',
    'android.permission.READ_MEDIA_IMAGES',
]);

module.exports = function withNoLegacyStoragePermissions(config) {
    return withAndroidManifest(config, (manifestConfig) => {
        manifestConfig.modResults.manifest.$ = {
            ...manifestConfig.modResults.manifest.$,
            'xmlns:tools': 'http://schemas.android.com/tools',
        };
        const permissions = Array.isArray(manifestConfig.modResults.manifest['uses-permission'])
            ? manifestConfig.modResults.manifest['uses-permission'].filter(
                (permission) => !LEGACY_STORAGE_PERMISSIONS.has(permission?.$?.['android:name']),
            )
            : [];
        for (const name of LEGACY_STORAGE_PERMISSIONS) {
            permissions.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
        }
        manifestConfig.modResults.manifest['uses-permission'] = permissions;
        return manifestConfig;
    });
};

const path = require('node:path');
const { withSettingsGradle } = require('@expo/config-plugins');

module.exports = function withLiquidGlassCore(config) {
    return withSettingsGradle(config, (config) => {
        const settingsPath = config.modRequest.platformProjectRoot;
        const corePath = path.relative(settingsPath, path.join(__dirname, 'android-core'));
        const groovyPath = corePath.replace(/\\/g, '/').replace(/'/g, "\\'");
        const include = "include ':liquidglass-core'";
        const projectDirectory = `project(':liquidglass-core').projectDir = file('${groovyPath}')`;

        if (!config.modResults.contents.includes(include)) {
            config.modResults.contents += `\n${include}\n${projectDirectory}\n`;
        }

        return config;
    });
};

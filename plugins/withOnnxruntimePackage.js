const { withMainApplication } = require('@expo/config-plugins');

const PACKAGE_IMPORT = 'import ai.onnxruntime.reactnative.OnnxruntimePackage';
const PACKAGE_INSTANCE = 'add(OnnxruntimePackage())';

module.exports = function withOnnxruntimePackage(config) {
  return withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') {
      throw new Error('NewHu ONNX package registration expects a Kotlin MainApplication');
    }

    let contents = mod.modResults.contents;
    if (!contents.includes(PACKAGE_IMPORT)) {
      const anchor = 'import expo.modules.ApplicationLifecycleDispatcher';
      if (!contents.includes(anchor)) throw new Error('Could not locate MainApplication import anchor');
      contents = contents.replace(anchor, `${PACKAGE_IMPORT}\n\n${anchor}`);
    }

    if (!contents.includes(PACKAGE_INSTANCE)) {
      const anchor = 'PackageList(this).packages.apply {';
      if (!contents.includes(anchor)) throw new Error('Could not locate React package registration anchor');
      contents = contents.replace(anchor, `${anchor}\n              ${PACKAGE_INSTANCE}`);
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

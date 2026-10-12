module.exports = function (api) {
  api.cache(true);
  return {
    // unstable_transformImportMeta: the shared core (../src/audio/model/infer.ts) contains
    // import.meta.glob inside a try/catch; Hermes cannot parse bare import.meta, so Expo rewrites it.
    // At runtime import.meta.glob is not a function, the catch fires and loadShippedModel() returns null.
    // The mobile app therefore loads model.json explicitly (see src/debug/runModelCheck.ts).
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
  };
};

// SleepSmooth App Intents: config plugin. Copies SleepSmoothIntents.swift into the MAIN app target.
//
// Why the main target: App Intents metadata is extracted from the app target's own sources. Intents that live in a
// CocoaPods static module (like the Expo modules here) are not reliably discovered by Shortcuts.
//
// Free-provisioning safety: no entitlement, no App Group, no capability. App Intents need none of those.
// The plugin is idempotent (prebuild without --clean must not add the file twice).
const fs = require('fs');
const path = require('path');
const { IOSConfig, withXcodeProject } = require('expo/config-plugins');

// Both files go into the MAIN app target. The second one is also copied into the Live Activity extension by withLiveActivity.
const FILES = ['SleepSmoothIntents.swift', 'SleepSmoothLiveActivityIntents.swift'];

module.exports = function withAppIntents(config) {
  return withXcodeProject(config, (c) => {
    const project = c.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
    const destDir = path.join(c.modRequest.platformProjectRoot, projectName);
    fs.mkdirSync(destDir, { recursive: true });
    for (const FILE of FILES) {
      fs.copyFileSync(path.join(__dirname, FILE), path.join(destDir, FILE));
      const filepath = path.join(projectName, FILE);
      if (!project.hasFile(filepath)) {
        c.modResults = IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: projectName, project });
      }
    }
    return c;
  });
};

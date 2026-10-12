// SleepSmooth "Listening tonight" Live Activity: config plugin.
//
// ONE feature flag: the plugin prop `enabled` in app.json. When false (or when the plugin is removed) nothing below runs:
// no widget extension target, no NSSupportsLiveActivities, and `extra.liveActivity` is false so the JS side is a no-op.
//
// Free-provisioning safety: no App Group, no aps-environment, no push token. The extension's entitlements file is an empty
// dict. State travels in ActivityKit content state only. The extension is a separate app id (<bundle id>.LiveActivity).
//
// The Xcode helper functions in ./xcode are vendored from expo-live-activity 0.4.2 (MIT, Software Mansion).
const fs = require('fs');
const path = require('path');
const { withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const { addBuildPhases } = require('./xcode/addBuildPhases');
const { addPbxGroup } = require('./xcode/addPbxGroup');
const { addProductFile } = require('./xcode/addProductFile');
const { addTargetDependency } = require('./xcode/addTargetDependency');
const { addToPbxNativeTargetSection } = require('./xcode/addToPbxNativeTargetSection');
const { addToPbxProjectSection } = require('./xcode/addToPbxProjectSection');
const { addXCConfigurationList } = require('./xcode/addXCConfigurationList');

const TARGET = 'SleepSmoothLiveActivity';
const WIDGET_DIR = path.join(__dirname, 'widget');
const SHARED_ATTRIBUTES = path.join(__dirname, '..', '..', 'modules', 'sleepsmooth-live-activity', 'ios', 'SleepSmoothRecordingAttributes.swift');
// The Stop and Open buttons are LiveActivityIntents. Apple requires them in BOTH the app target and this extension.
// The app-target copy is added by plugins/withAppIntents; this is the same file.
const SHARED_INTENTS = path.join(__dirname, '..', 'withAppIntents', 'SleepSmoothLiveActivityIntents.swift');
const EMPTY_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>
`;

function stageWidgetFiles(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
  const files = { swiftFiles: [], entitlementFiles: [], plistFiles: [], assetDirectories: [], intentFiles: [], otherFiles: [] };
  for (const f of fs.readdirSync(WIDGET_DIR)) {
    fs.copyFileSync(path.join(WIDGET_DIR, f), path.join(targetPath, f));
    if (f.endsWith('.swift')) files.swiftFiles.push(f);
    else if (f.endsWith('.plist')) files.plistFiles.push(f);
  }
  // Single source of truth for the attributes: the app module's copy.
  fs.copyFileSync(SHARED_ATTRIBUTES, path.join(targetPath, 'SleepSmoothRecordingAttributes.swift'));
  files.swiftFiles.push('SleepSmoothRecordingAttributes.swift');
  fs.copyFileSync(SHARED_INTENTS, path.join(targetPath, 'SleepSmoothLiveActivityIntents.swift'));
  files.swiftFiles.push('SleepSmoothLiveActivityIntents.swift');
  fs.writeFileSync(path.join(targetPath, `${TARGET}.entitlements`), EMPTY_ENTITLEMENTS);
  return files;
}

module.exports = function withLiveActivity(config, props = {}) {
  const enabled = props.enabled !== false;
  config.extra = { ...(config.extra || {}), liveActivity: enabled };
  if (!enabled) return config;

  const bundleIdentifier = `${config.ios?.bundleIdentifier}.LiveActivity`;

  config = withInfoPlist(config, (c) => {
    c.modResults.NSSupportsLiveActivities = true;
    c.modResults.NSSupportsLiveActivitiesFrequentUpdates = false;
    return c;
  });

  return withXcodeProject(config, (c) => {
    const xcodeProject = c.modResults;
    // Idempotent: prebuild without --clean must not add a second target.
    if (xcodeProject.pbxTargetByName(TARGET)) return c;
    const groupName = 'Embed Foundation Extensions';
    const targetPath = path.join(c.modRequest.platformProjectRoot, TARGET);
    const widgetFiles = stageWidgetFiles(targetPath);
    const targetUuid = xcodeProject.generateUuid();
    const xCConfigurationList = addXCConfigurationList(xcodeProject, {
      targetName: TARGET,
      currentProjectVersion: c.ios?.buildNumber || '1',
      bundleIdentifier,
      deploymentTarget: '16.2',
      marketingVersion: c.version,
      developmentTeam: c.ios?.appleTeamId,
    });
    const productFile = addProductFile(xcodeProject, { targetName: TARGET, groupName });
    const target = addToPbxNativeTargetSection(xcodeProject, { targetName: TARGET, targetUuid, productFile, xCConfigurationList });
    addToPbxProjectSection(xcodeProject, target);
    addTargetDependency(xcodeProject, target);
    addBuildPhases(xcodeProject, { targetUuid, groupName, productFile, widgetFiles });
    addPbxGroup(xcodeProject, { targetName: TARGET, widgetFiles });
    return c;
  });
};

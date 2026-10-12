import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The App Intents live in the main app target and the Expo module lives in a pod: they cannot share code, so the two
// string keys are duplicated. This test fails if they drift apart.
const read = (p: string) => readFileSync(resolve(__dirname, '../../mobile', p), 'utf8');
const grab = (src: string, re: RegExp) => re.exec(src)?.[1];

describe('automation bridge keys', () => {
  const shared = read('plugins/withAppIntents/SleepSmoothLiveActivityIntents.swift');
  const intents = shared;
  const intentsApp = read('plugins/withAppIntents/SleepSmoothIntents.swift');
  const module_ = read('modules/sleepsmooth-live-activity/ios/SleepSmoothAutomationModule.swift');
  it('pending key matches', () => {
    const a = grab(intents, /pendingKey = "([^"]+)"/);
    expect(a).toBeTruthy();
    expect(grab(module_, /pendingKey = "([^"]+)"/)).toBe(a);
  });
  it('notification name matches', () => {
    const a = grab(intents, /Notification\.Name\("([^"]+)"\)/);
    expect(a).toBeTruthy();
    expect(grab(module_, /Notification\.Name\("([^"]+)"\)/)).toBe(a);
  });
  it('payload shape is what parsePendingCommand reads', () => {
    expect(intents).toContain('\\"kind\\":\\"\\(kind)\\"');
    expect(intents).toContain('\\"at\\":');
  });
  it('the Live Activity intents are LiveActivityIntents defined once, in the file both targets compile', () => {
    expect(shared).toMatch(/struct MorningStopIntent: LiveActivityIntent/);
    expect(shared).toMatch(/struct MorningOpenIntent: LiveActivityIntent/);
    expect(shared.match(/@available\(iOS 17\.0, \*\)/g)?.length).toBe(2);
    expect(intentsApp).not.toContain('enum SleepSmoothAutomation');
    expect(shared).toContain('enqueue(kind: "morning-stop")');
    expect(shared).toContain('enqueue(kind: "morning-open")');
  });
  it('the plugins copy the shared file into the app target and the extension', () => {
    expect(read('plugins/withAppIntents/index.js')).toContain('SleepSmoothLiveActivityIntents.swift');
    expect(read('plugins/withLiveActivity/index.js')).toContain('SleepSmoothLiveActivityIntents.swift');
  });
  it('the module is registered', () => {
    expect(read('modules/sleepsmooth-live-activity/expo-module.config.json')).toContain('SleepSmoothAutomationModule');
  });
  it('declares no App Group or push entitlement anywhere in the new native files', () => {
    for (const s of [shared, intentsApp, module_]) {
      expect(s).not.toMatch(/application-groups|aps-environment|suiteName/);
    }
  });
});

describe('config plugin plist strings match the shared copy', () => {
  it('Health and Motion usage descriptions are the claims.ts text', async () => {
    const { HEALTH_PLIST_USAGE, MOTION_PLIST_USAGE } = await import('../content/claims');
    expect(read('plugins/withHealthKit/index.js')).toContain(HEALTH_PLIST_USAGE);
    expect(read('plugins/withMotionUsage.js')).toContain(MOTION_PLIST_USAGE);
  });
  it('the HealthKit entitlement is only added behind the flag', () => {
    const src = read('plugins/withHealthKit/index.js');
    expect(src).toContain('props.healthkit === true');
    expect(src.indexOf('if (!enabled) return config;')).toBeLessThan(src.indexOf("'com.apple.developer.healthkit'"));
  });
});

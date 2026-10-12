Pod::Spec.new do |s|
  s.name           = 'SleepSmoothActivityBridge'
  s.version        = '0.1.0'
  s.summary        = 'Local ActivityKit Live Activity for SleepSmooth overnight listening'
  s.description    = 'Starts, updates and ends one local Live Activity; read-only Apple Health queries; motion-activity history. No push, no App Group.'
  s.author         = 'SleepSmooth'
  s.homepage       = 'https://example.invalid/sleepsmooth'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '16.2' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'HealthKit', 'CoreMotion'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end

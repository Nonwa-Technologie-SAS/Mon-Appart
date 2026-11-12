import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Garde-fous de configuration. Le répertoire de travail est `apps/flutter`.
void main() {
  test('Android release interdit la sauvegarde et le trafic en clair', () {
    final manifest = File('android/app/src/main/AndroidManifest.xml')
        .readAsStringSync();
    expect(manifest, contains('android:allowBackup="false"'));
    expect(manifest, contains('android:usesCleartextTraffic="false"'));
    expect(
      File('android/app/src/main/res/xml/network_security_config.xml')
          .readAsStringSync(),
      contains('cleartextTrafficPermitted="false"'),
    );
    final debug = File(
      'android/app/src/debug/res/xml/network_security_config.xml',
    ).readAsStringSync();
    expect(debug, contains('10.0.2.2'));
    expect(debug, contains('localhost'));
  });

  test('iOS n\'autorise pas le HTTP arbitraire', () {
    final plist = File('ios/Runner/Info.plist').readAsStringSync();
    expect(plist.contains('NSAllowsArbitraryLoads'), isFalse);
    expect(plist, contains('NSAllowsLocalNetworking'));
    expect(plist, contains('NSLocationWhenInUseUsageDescription'));
    expect(plist.contains('NSLocationAlways'), isFalse);
  });

  test('la release Android est encore signée avec la clé debug : publication NO-GO', () {
    final gradle = File('android/app/build.gradle.kts').readAsStringSync();
    expect(gradle, contains('signingConfigs.getByName("debug")'));
  });

  test('le code Dart mobile n\'embarque pas de secret évident', () {
    final forbidden = <String>['AKIA', 'sk_live_', 'BEGIN PRIVATE KEY', 'AIza'];
    final roots = [Directory('lib'), Directory('android'), Directory('ios')];
    final hits = <String>[];
    for (final root in roots) {
      for (final entity in root.listSync(recursive: true)) {
        if (entity is! File) {
          continue;
        }
        final path = entity.path.replaceAll('\\', '/');
        if (path.contains('/build/') || path.endsWith('.png')) {
          continue;
        }
        final text = _readText(entity);
        if (text == null) {
          continue;
        }
        for (final needle in forbidden) {
          if (text.contains(needle)) {
            hits.add('$path contient $needle');
          }
        }
      }
    }
    expect(hits, isEmpty);
  });
}

String? _readText(File file) {
  try {
    return file.readAsStringSync();
  } on FileSystemException {
    return null;
  }
}

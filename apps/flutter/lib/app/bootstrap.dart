import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../core/offline/file_key_value_store.dart';
import '../core/offline/offline_providers.dart';
import 'app.dart';
import 'config/app_config.dart';
import 'config/app_environment.dart';
import 'providers.dart';

Future<void> bootstrap({AppConfig? config}) async {
  WidgetsFlutterBinding.ensureInitialized();

  AppConfig resolved;
  try {
    resolved = config ?? AppConfig.fromEnvironment();
  } on FormatException catch (error) {
    FlutterError.reportError(
      FlutterErrorDetails(exception: error, library: 'mon_appart.bootstrap'),
    );
    resolved = const AppConfig(
      environment: AppEnvironment.local,
      apiBaseUrl: null,
      enableNetworkLogs: false,
    );
  }

  final support = await getApplicationSupportDirectory();
  final store = FileKeyValueStore(
    File('${support.path}${Platform.pathSeparator}offline-cache.json'),
  );

  runApp(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(resolved),
        keyValueStoreProvider.overrideWithValue(store),
      ],
      child: const MonAppartApp(),
    ),
  );
}

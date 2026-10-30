import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:mon_appart/app/app.dart';
import 'package:mon_appart/app/config/app_config.dart';
import 'package:mon_appart/app/config/app_environment.dart';
import 'package:mon_appart/app/providers.dart';
import 'package:mon_appart/app/router/app_router.dart';
import 'package:mon_appart/core/api/api_client.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_store.dart';
import 'package:mon_appart/core/offline/key_value_store.dart';
import 'package:mon_appart/core/offline/memory_key_value_store.dart';
import 'package:mon_appart/core/offline/offline_providers.dart';
import 'package:mon_appart/features/messaging/data/messaging_realtime.dart';
import 'package:mon_appart/features/messaging/presentation/messaging_providers.dart';
import 'package:mon_appart/features/notifications/data/push_device_store.dart';
import 'package:mon_appart/features/notifications/domain/device_notification_permission.dart';
import 'package:mon_appart/features/notifications/domain/push_token_source.dart';
import 'package:mon_appart/features/notifications/presentation/push_providers.dart';

import 'fake_api_client.dart';

AppConfig testConfig({
  String url = 'http://10.0.2.2:4000',
  AppEnvironment environment = AppEnvironment.local,
  bool logs = false,
  String? publicWebHost,
}) {
  return AppConfig(
    environment: environment,
    apiBaseUrl: url.isEmpty ? null : Uri.parse(url),
    enableNetworkLogs: logs,
    publicWebHost: publicWebHost,
    mapTileUrl: null,
  );
}

Widget pumpMonAppart({
  required AppConfig config,
  ApiClient? apiClient,
  SessionStore? sessionStore,
  KeyValueStore? keyValueStore,
  String initialLocation = '/',
  List<Override> overrides = const [],
}) {
  final client = apiClient ?? FakeApiClient();
  return ProviderScope(
    overrides: [
      appConfigProvider.overrideWithValue(config),
      sessionStoreProvider.overrideWithValue(
        sessionStore ?? InMemorySessionStore(),
      ),
      keyValueStoreProvider.overrideWithValue(
        keyValueStore ?? MemoryKeyValueStore(),
      ),
      tokenRefresherProvider.overrideWithValue(null),
      apiClientProvider.overrideWithValue(client),
      goRouterProvider.overrideWithValue(
        createRouter(config, initialLocation: initialLocation),
      ),
      deviceNotificationPermissionProvider.overrideWithValue(
        const UnavailableNotificationPermission(),
      ),
      pushTokenSourceProvider.overrideWithValue(const NullPushTokenSource()),
      pushDeviceStoreProvider.overrideWithValue(InMemoryPushDeviceStore()),
      messagingRealtimeProvider.overrideWithValue(
        const NullMessagingRealtime(),
      ),
      ...overrides,
    ],
    child: const MonAppartApp(),
  );
}

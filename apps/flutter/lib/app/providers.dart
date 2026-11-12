import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api/api_client.dart';
import '../core/api/dio_api_client.dart';
import '../core/api/observing_api_client.dart';
import '../core/auth/secure_session_store.dart';
import '../core/auth/session_store.dart';
import '../core/auth/token_refresher.dart';
import '../core/errors/app_failure.dart';
import '../core/ids/uuid_v4.dart';
import '../core/logging/app_logger.dart';
import '../core/observability/telemetry_client.dart';
import '../core/observability/telemetry_event.dart';
import '../core/observability/telemetry_route_observer.dart';
import '../core/offline/offline_providers.dart';
import '../features/explore/data/search_repository.dart';
import '../features/home/data/health_repository.dart';
import '../features/home/data/recommendation_repository.dart';
import 'config/api_endpoints.dart';
import 'config/app_config.dart';
import 'router/app_router.dart';

final appConfigProvider = Provider<AppConfig>((ref) {
  return AppConfig.fromEnvironment();
});

final sessionStoreProvider = Provider<SessionStore>((ref) {
  return SecureSessionStore();
});

class SessionEpoch extends Notifier<int> {
  @override
  int build() => 0;

  void bump() => state++;
}

final sessionEpochProvider = NotifierProvider<SessionEpoch, int>(
  SessionEpoch.new,
);

final tokenRefresherProvider = Provider<TokenRefresher?>((ref) {
  final baseUrl = ref.watch(appConfigProvider).apiBaseUrl;
  if (baseUrl == null) {
    return null;
  }
  return TokenRefresher(
    store: ref.watch(sessionStoreProvider),
    endpoints: ApiEndpoints(baseUrl),
    onFinished: (outcome) {
      ref
          .read(telemetryProvider)
          .record(
            severity: outcome == 'unavailable'
                ? TelemetrySeverity.medium
                : TelemetrySeverity.low,
            kind: TelemetryKind.auth,
            operation: 'auth.refresh',
            message: 'Renouvellement de session.',
            attributes: {'outcome': outcome},
          );
    },
  );
});

final appLoggerProvider = Provider<AppLogger>((ref) {
  final config = ref.watch(appConfigProvider);
  return AppLogger(enabled: config.enableNetworkLogs);
});

final launchStartedAtProvider = Provider<DateTime>((ref) => DateTime.now());

final telemetryProvider = Provider<TelemetryClient>((ref) {
  final config = ref.watch(appConfigProvider);
  return TelemetryClient(
    environment: config.environment,
    logs: ref.watch(appLoggerProvider),
    store: ref.watch(keyValueStoreProvider),
    clock: ref.watch(offlineClockProvider),
    sessionId: UuidV4.generate(),
    enabled: config.telemetryEnabled,
  );
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final config = ref.watch(appConfigProvider);
  final inner = DioApiClient.create(
    config: config,
    sessionStore: ref.watch(sessionStoreProvider),
    logger: ref.watch(appLoggerProvider),
    refresher: ref.watch(tokenRefresherProvider),
    telemetry: ref.watch(telemetryProvider),
    onSessionCleared: () {
      ref.read(sessionEpochProvider.notifier).bump();
    },
  );
  return ObservingApiClient(inner, ref.watch(connectivityMonitorProvider));
});

final apiEndpointsProvider = Provider<ApiEndpoints>((ref) {
  final config = ref.watch(appConfigProvider);
  final baseUrl = config.apiBaseUrl;
  if (baseUrl == null) {
    throw const ConfigurationFailure();
  }
  return ApiEndpoints(baseUrl);
});

final healthRepositoryProvider = Provider<HealthRepository>((ref) {
  return HealthRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
  );
});

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  return SearchRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    cache: ref.watch(offlineCacheProvider),
  );
});

final recommendationRepositoryProvider = Provider<RecommendationRepository>((
  ref,
) {
  return RecommendationRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    cache: ref.watch(offlineCacheProvider),
  );
});

final goRouterProvider = Provider<GoRouter>((ref) {
  final config = ref.watch(appConfigProvider);
  return createRouter(
    config,
    observers: [TelemetryRouteObserver(ref.watch(telemetryProvider))],
  );
});

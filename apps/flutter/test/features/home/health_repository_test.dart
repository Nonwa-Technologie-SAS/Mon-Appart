import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/home/data/health_repository.dart';

import '../../helpers/fake_api_client.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  test('appelle /health/live et mappe le JSON', () async {
    final client = FakeApiClient(
      serveHealthLive: false,
      handler: (uri) async {
        expect(uri.path, '/health/live');
        return {'status': 'ok', 'service': 'api'};
      },
    );
    final repo = HealthRepository(client: client, endpoints: endpoints);
    final live = await repo.fetchLive();
    expect(live.service, 'api');
    expect(client.calls, 1);
  });

  test('propage une AppFailure réseau', () async {
    final client = FakeApiClient(
      serveHealthLive: false,
      handler: (_) async => throw const NetworkFailure(),
    );
    final repo = HealthRepository(client: client, endpoints: endpoints);
    await expectLater(repo.fetchLive(), throwsA(isA<NetworkFailure>()));
  });
}

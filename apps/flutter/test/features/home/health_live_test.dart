import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/home/data/health_live.dart';

void main() {
  test('parse GET /health/live', () {
    final live = HealthLive.fromJson(const {
      'status': 'ok',
      'service': 'api',
      'version': 'abc',
    });
    expect(live.isOk, isTrue);
    expect(live.service, 'api');
    expect(live.version, 'abc');
  });

  test('version optionnelle', () {
    final live = HealthLive.fromJson(const {'status': 'ok', 'service': 'api'});
    expect(live.version, isNull);
  });

  test('rejette un JSON incomplet', () {
    expect(
      () => HealthLive.fromJson(const {'status': 'ok'}),
      throwsFormatException,
    );
  });
}

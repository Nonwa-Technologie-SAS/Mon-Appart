import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/offline/sync_rules.dart';

void main() {
  test('réseau et timeout sont temporaires', () {
    expect(SyncRules.isTransient(const NetworkFailure()), isTrue);
    expect(SyncRules.isTransient(const TimeoutFailure()), isTrue);
    expect(
      SyncRules.isTransient(const HttpFailure(statusCode: 503, message: 'x')),
      isTrue,
    );
    expect(
      SyncRules.isTransient(const HttpFailure(statusCode: 429, message: 'x')),
      isTrue,
    );
  });

  test('4xx métier est définitif, 401 est une session', () {
    expect(
      SyncRules.isPermanent(const HttpFailure(statusCode: 400, message: 'x')),
      isTrue,
    );
    expect(
      SyncRules.isPermanent(const HttpFailure(statusCode: 404, message: 'x')),
      isTrue,
    );
    expect(
      SyncRules.isUnauthenticated(
        const HttpFailure(statusCode: 401, message: 'x'),
      ),
      isTrue,
    );
    expect(
      SyncRules.isPermanent(const HttpFailure(statusCode: 401, message: 'x')),
      isFalse,
    );
  });
}

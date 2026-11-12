import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/auth/token_refresher.dart';

import '../../helpers/auth_fixtures.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.onFetch);

  final Future<ResponseBody> Function(RequestOptions options) onFetch;
  var calls = 0;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    calls += 1;
    return onFetch(options);
  }
}

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  test('une seule rotation concurrente', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'old', refreshToken: 'ref-1'),
    );
    final adapter = _Adapter((options) async {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return ResponseBody.fromString(
        jsonEncode(issuedAuthJson(accessToken: 'new', refreshToken: 'ref-2')),
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    });
    final refresher = TokenRefresher(
      store: store,
      endpoints: endpoints,
      dio: Dio()..httpClientAdapter = adapter,
    );

    final results = await Future.wait([
      refresher.refresh(),
      refresher.refresh(),
      refresher.refresh(),
    ]);

    expect(adapter.calls, 1);
    expect(results.every((tokens) => tokens?.accessToken == 'new'), isTrue);
    expect(await store.readRefreshToken(), 'ref-2');
  });

  test('absence de refreshToken local : pas d\'appel réseau', () async {
    final adapter = _Adapter((options) async {
      fail('aucun appel attendu');
    });
    final refresher = TokenRefresher(
      store: InMemorySessionStore(),
      endpoints: endpoints,
      dio: Dio()..httpClientAdapter = adapter,
    );
    expect(await refresher.refresh(), isNull);
    expect(adapter.calls, 0);
  });
}

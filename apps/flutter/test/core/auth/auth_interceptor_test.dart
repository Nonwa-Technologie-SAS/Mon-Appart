import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/auth/auth_interceptor.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/auth/token_refresher.dart';

import '../../helpers/auth_fixtures.dart';

class _ScriptedAdapter implements HttpClientAdapter {
  _ScriptedAdapter(this.onFetch);

  final Future<ResponseBody> Function(RequestOptions options) onFetch;
  final paths = <String>[];
  final methods = <String>[];

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    methods.add(options.method);
    paths.add(options.uri.path);
    return onFetch(options);
  }
}

ResponseBody jsonBody(int status, Object body) {
  return ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  test('ajoute le Bearer et conserve la session si 200', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'tok', refreshToken: 'ref'),
    );
    final dio = Dio();
    dio.httpClientAdapter = _ScriptedAdapter(
      (options) async => jsonBody(200, {'ok': true}),
    );
    dio.interceptors.add(AuthInterceptor(store, dio: dio));

    final response = await dio.get<Map<String, Object?>>(
      'https://example.test/x',
    );
    expect(response.requestOptions.headers['Authorization'], 'Bearer tok');
    expect(await store.readAccessToken(), 'tok');
  });

  test('renouvelle une seule fois sur TOKEN_EXPIRED puis rejoue GET', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'old', refreshToken: 'ref-1'),
    );
    final refreshDio = Dio();
    var refreshCalls = 0;
    refreshDio.httpClientAdapter = _ScriptedAdapter((options) async {
      refreshCalls += 1;
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return jsonBody(
        200,
        issuedAuthJson(accessToken: 'new', refreshToken: 'ref-2'),
      );
    });
    final refresher = TokenRefresher(
      store: store,
      endpoints: endpoints,
      dio: refreshDio,
    );

    final adapter = _ScriptedAdapter((options) async {
      if (options.extra['authRetried'] == true) {
        return jsonBody(200, {'ok': true});
      }
      return jsonBody(401, {'code': 'TOKEN_EXPIRED', 'message': 'expiré'});
    });
    final dio = Dio();
    dio.httpClientAdapter = adapter;
    dio.interceptors.add(
      AuthInterceptor(store, dio: dio, refresher: refresher),
    );

    final first = dio.get<void>('http://10.0.2.2:4000/api/v1/listings/1');
    final second = dio.get<void>('http://10.0.2.2:4000/api/v1/listings/2');
    await Future.wait([first, second]);

    expect(refreshCalls, 1);
    expect(await store.readAccessToken(), 'new');
    expect(await store.readRefreshToken(), 'ref-2');
    expect(
      adapter.paths.where((path) => path.contains('/listings/')).length,
      4,
    );
  });

  test('ne rejoue pas POST /appointments après refresh', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'old', refreshToken: 'ref-1'),
    );
    final refreshDio = Dio();
    refreshDio.httpClientAdapter = _ScriptedAdapter((options) async {
      return jsonBody(
        200,
        issuedAuthJson(accessToken: 'new', refreshToken: 'ref-2'),
      );
    });
    final adapter = _ScriptedAdapter((options) async {
      return jsonBody(401, {'code': 'TOKEN_EXPIRED', 'message': 'expiré'});
    });
    final dio = Dio();
    dio.httpClientAdapter = adapter;
    dio.interceptors.add(
      AuthInterceptor(
        store,
        dio: dio,
        refresher: TokenRefresher(
          store: store,
          endpoints: endpoints,
          dio: refreshDio,
        ),
      ),
    );

    await expectLater(
      dio.post<void>('http://10.0.2.2:4000/api/v1/appointments'),
      throwsA(isA<DioException>()),
    );
    expect(adapter.paths, ['/api/v1/appointments']);
    expect(await store.readAccessToken(), 'new');
  });

  test('ne rejoue pas POST /listings après refresh', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'old', refreshToken: 'ref-1'),
    );
    final refreshDio = Dio();
    refreshDio.httpClientAdapter = _ScriptedAdapter((options) async {
      return jsonBody(
        200,
        issuedAuthJson(accessToken: 'new', refreshToken: 'ref-2'),
      );
    });
    final adapter = _ScriptedAdapter((options) async {
      return jsonBody(401, {'code': 'TOKEN_EXPIRED', 'message': 'expiré'});
    });
    final dio = Dio();
    dio.httpClientAdapter = adapter;
    dio.interceptors.add(
      AuthInterceptor(
        store,
        dio: dio,
        refresher: TokenRefresher(
          store: store,
          endpoints: endpoints,
          dio: refreshDio,
        ),
      ),
    );

    await expectLater(
      dio.post<void>('http://10.0.2.2:4000/api/v1/listings'),
      throwsA(isA<DioException>()),
    );
    expect(adapter.paths, ['/api/v1/listings']);
    expect(await store.readAccessToken(), 'new');
  });

  test(
    'ne rejoue pas POST /conversations/:id/messages après refresh',
    () async {
      const conversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      final store = InMemorySessionStore();
      await store.save(
        const SessionTokens(accessToken: 'old', refreshToken: 'ref-1'),
      );
      final refreshDio = Dio();
      refreshDio.httpClientAdapter = _ScriptedAdapter((options) async {
        return jsonBody(
          200,
          issuedAuthJson(accessToken: 'new', refreshToken: 'ref-2'),
        );
      });
      final adapter = _ScriptedAdapter((options) async {
        return jsonBody(401, {'code': 'TOKEN_EXPIRED', 'message': 'expiré'});
      });
      final dio = Dio();
      dio.httpClientAdapter = adapter;
      dio.interceptors.add(
        AuthInterceptor(
          store,
          dio: dio,
          refresher: TokenRefresher(
            store: store,
            endpoints: endpoints,
            dio: refreshDio,
          ),
        ),
      );

      await expectLater(
        dio.post<void>(
          'http://10.0.2.2:4000/api/v1/conversations/$conversationId/messages',
        ),
        throwsA(isA<DioException>()),
      );
      expect(adapter.paths, ['/api/v1/conversations/$conversationId/messages']);
      expect(await store.readAccessToken(), 'new');
    },
  );

  test('efface la session si le refresh échoue', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'tok', refreshToken: 'ref'),
    );
    final refreshDio = Dio();
    refreshDio.httpClientAdapter = _ScriptedAdapter((options) async {
      return jsonBody(401, {'code': 'SESSION_REVOKED', 'message': 'révoqué'});
    });
    final dio = Dio();
    dio.httpClientAdapter = _ScriptedAdapter((options) async {
      return jsonBody(401, {'code': 'TOKEN_EXPIRED', 'message': 'expiré'});
    });
    dio.interceptors.add(
      AuthInterceptor(
        store,
        dio: dio,
        refresher: TokenRefresher(
          store: store,
          endpoints: endpoints,
          dio: refreshDio,
        ),
      ),
    );

    await expectLater(
      dio.get<void>('http://10.0.2.2:4000/api/v1/auth/me'),
      throwsA(isA<DioException>()),
    );
    expect(await store.readAccessToken(), isNull);
  });

  test('ne touche pas aux jetons sur 403', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'tok', refreshToken: 'ref'),
    );
    final dio = Dio();
    dio.httpClientAdapter = _ScriptedAdapter(
      (options) async =>
          jsonBody(403, {'code': 'FORBIDDEN', 'message': 'interdit'}),
    );
    dio.interceptors.add(AuthInterceptor(store, dio: dio));

    await expectLater(
      dio.get<void>('https://example.test/x'),
      throwsA(isA<DioException>()),
    );
    expect(await store.readAccessToken(), 'tok');
  });
}

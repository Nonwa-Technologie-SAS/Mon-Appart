import 'package:mon_appart/core/api/api_client.dart';
import 'package:mon_appart/core/errors/app_failure.dart';

class FakeApiClient implements ApiClient {
  FakeApiClient({
    this.handler,
    this.listHandler,
    this.methodAwareHandler,
    this.serveHealthLive = true,
  });

  /// Intercepte `GET /health/live` pour les sondes Offline-First des tests widget.
  final bool serveHealthLive;

  Future<Map<String, Object?>> Function(Uri uri)? handler;
  Future<Map<String, Object?>> Function(Uri uri, String method)?
  methodAwareHandler;
  Future<List<Object?>> Function(Uri uri)? listHandler;
  int calls = 0;
  final List<Uri> uris = [];
  final List<String> methods = [];
  Map<String, Object?>? lastBody;
  Map<String, String>? lastHeaders;
  Uri? lastPutBytesUri;
  List<int>? lastPutBytes;
  Map<String, String>? lastPutHeaders;

  @override
  Future<Map<String, Object?>> getJson(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    lastHeaders = headers;
    return _send('GET', uri, query: query);
  }

  @override
  Future<List<Object?>> getJsonList(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) async {
    calls += 1;
    methods.add('GET');
    final resolved = _withQuery(uri, query);
    uris.add(resolved);
    final next = listHandler;
    if (next != null) {
      return next(resolved);
    }
    throw const ParsingFailure(
      message: 'Réponse liste inattendue dans le doublure de test.',
    );
  }

  @override
  Future<Map<String, Object?>> postJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    lastBody = body;
    lastHeaders = headers;
    return _send('POST', uri, query: query);
  }

  @override
  Future<Map<String, Object?>> putJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    lastBody = body;
    return _send('PUT', uri, query: query);
  }

  @override
  Future<Map<String, Object?>> patchJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    lastBody = body;
    return _send('PATCH', uri, query: query);
  }

  @override
  Future<Map<String, Object?>> deleteJson(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    lastHeaders = headers;
    return _send('DELETE', uri, query: query);
  }

  @override
  Future<void> putBytes(
    Uri uri, {
    required List<int> bytes,
    Map<String, String>? headers,
    void Function(int sent, int total)? onProgress,
  }) async {
    calls += 1;
    methods.add('PUT');
    uris.add(uri);
    lastPutBytesUri = uri;
    lastPutBytes = bytes;
    lastPutHeaders = headers;
    onProgress?.call(bytes.length, bytes.length);
  }

  Future<Map<String, Object?>> _send(
    String method,
    Uri uri, {
    Map<String, Object?>? query,
  }) async {
    calls += 1;
    methods.add(method);
    final resolved = _withQuery(uri, query);
    uris.add(resolved);
    if (method == 'GET' &&
        resolved.path.endsWith('/health/live') &&
        serveHealthLive) {
      return const {'status': 'ok', 'service': 'api'};
    }
    final methodHandler = methodAwareHandler;
    if (methodHandler != null) {
      return methodHandler(resolved, method);
    }
    final next = handler;
    if (next == null) {
      throw const NetworkFailure();
    }
    return next(resolved);
  }

  static Uri _withQuery(Uri uri, Map<String, Object?>? query) {
    if (query == null || query.isEmpty) {
      return uri;
    }
    final params = <String, String>{
      ...uri.queryParameters,
      for (final entry in query.entries)
        if (entry.value != null && '${entry.value}'.isNotEmpty)
          entry.key: '${entry.value}',
    };
    return uri.replace(queryParameters: params);
  }
}

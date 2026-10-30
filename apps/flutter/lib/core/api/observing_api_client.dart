import '../errors/app_failure.dart';
import '../offline/connectivity_monitor.dart';
import 'api_client.dart';

class ObservingApiClient implements ApiClient {
  ObservingApiClient(this._inner, this._monitor);

  final ApiClient _inner;
  final ConnectivityMonitor _monitor;

  @override
  Future<Map<String, Object?>> getJson(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _guard(() => _inner.getJson(uri, query: query, headers: headers));
  }

  @override
  Future<List<Object?>> getJsonList(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _guard(
      () => _inner.getJsonList(uri, query: query, headers: headers),
    );
  }

  @override
  Future<Map<String, Object?>> postJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _guard(
      () => _inner.postJson(uri, body: body, query: query, headers: headers),
    );
  }

  @override
  Future<Map<String, Object?>> putJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _guard(
      () => _inner.putJson(uri, body: body, query: query, headers: headers),
    );
  }

  @override
  Future<Map<String, Object?>> patchJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _guard(
      () => _inner.patchJson(uri, body: body, query: query, headers: headers),
    );
  }

  @override
  Future<Map<String, Object?>> deleteJson(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _guard(() => _inner.deleteJson(uri, query: query, headers: headers));
  }

  @override
  Future<void> putBytes(
    Uri uri, {
    required List<int> bytes,
    Map<String, String>? headers,
    void Function(int sent, int total)? onProgress,
  }) async {
    try {
      await _inner.putBytes(
        uri,
        bytes: bytes,
        headers: headers,
        onProgress: onProgress,
      );
      _monitor.recordSuccess();
    } on AppFailure catch (error) {
      _monitor.recordFailure(error);
      rethrow;
    }
  }

  Future<T> _guard<T>(Future<T> Function() request) async {
    try {
      final result = await request();
      _monitor.recordSuccess();
      return result;
    } on AppFailure catch (error) {
      _monitor.recordFailure(error);
      rethrow;
    }
  }
}

/// Client HTTP abstrait : les fonctionnalités ne dépendent pas de Dio.
abstract class ApiClient {
  Future<Map<String, Object?>> getJson(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  });

  Future<List<Object?>> getJsonList(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  });

  Future<Map<String, Object?>> postJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  });

  Future<Map<String, Object?>> putJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  });

  Future<Map<String, Object?>> patchJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  });

  Future<Map<String, Object?>> deleteJson(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  });

  /// PUT binaire vers une URL présignée (stockage objet). Sans Bearer Nest.
  Future<void> putBytes(
    Uri uri, {
    required List<int> bytes,
    Map<String, String>? headers,
    void Function(int sent, int total)? onProgress,
  });
}

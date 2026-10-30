import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/api/dio_api_client.dart';
import 'package:mon_appart/core/errors/app_failure.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.status, this.body);

  final int status;
  final String body;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      body,
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  test('désérialise une réponse JSON 200', () async {
    final dio = Dio()..httpClientAdapter = _Adapter(200, '{"status":"ok"}');
    final client = DioApiClient(dio: dio);
    final json = await client.getJson(
      Uri.parse('http://example.test/health/live'),
    );
    expect(json['status'], 'ok');
  });

  test('désérialise un tableau JSON', () async {
    final dio = Dio()
      ..httpClientAdapter = _Adapter(200, '[{"id":"1"},{"id":"2"}]');
    final client = DioApiClient(dio: dio);
    final items = await client.getJsonList(
      Uri.parse('http://example.test/api/v1/auth/sessions'),
    );
    expect(items, hasLength(2));
  });

  test('convertit une erreur HTTP en AppFailure', () async {
    final dio = Dio()
      ..httpClientAdapter = _Adapter(
        503,
        '{"code":"SERVICE_UNAVAILABLE","message":"indisponible"}',
      );
    final client = DioApiClient(dio: dio);
    await expectLater(
      client.getJson(Uri.parse('http://example.test/health')),
      throwsA(
        isA<HttpFailure>().having((f) => f.code, 'code', 'SERVICE_UNAVAILABLE'),
      ),
    );
  });
}

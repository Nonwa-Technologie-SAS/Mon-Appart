import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/errors/error_mapper.dart';

void main() {
  const mapper = ErrorMapper();

  test('timeout Dio → TimeoutFailure', () {
    final failure = mapper.fromDio(
      DioException(
        requestOptions: RequestOptions(path: '/health/live'),
        type: DioExceptionType.connectionTimeout,
      ),
    );
    expect(failure, isA<TimeoutFailure>());
  });

  test('connexion Dio → NetworkFailure', () {
    final failure = mapper.fromDio(
      DioException(
        requestOptions: RequestOptions(path: '/health/live'),
        type: DioExceptionType.connectionError,
      ),
    );
    expect(failure, isA<NetworkFailure>());
  });

  test('lit le corps d\'erreur Nest', () {
    final failure = mapper.fromDio(
      DioException(
        requestOptions: RequestOptions(path: '/api/v1/auth/login'),
        type: DioExceptionType.badResponse,
        response: Response<Map<String, Object?>>(
          requestOptions: RequestOptions(path: '/api/v1/auth/login'),
          statusCode: 401,
          data: const {
            'statusCode': 401,
            'code': 'INVALID_CREDENTIALS',
            'message': 'Identifiants invalides',
            'requestId': 'req-1',
          },
        ),
      ),
    );
    expect(failure, isA<HttpFailure>());
    expect(failure.code, 'INVALID_CREDENTIALS');
    expect(failure.message, 'Identifiants invalides');
    expect(failure.statusCode, 401);
    expect(failure.requestId, 'req-1');
  });

  test('503 sans corps → SERVICE_UNAVAILABLE', () {
    final failure = mapper.fromResponse(
      Response<void>(
        requestOptions: RequestOptions(path: '/health'),
        statusCode: 503,
      ),
    );
    expect(failure.code, 'SERVICE_UNAVAILABLE');
    expect(failure.statusCode, 503);
  });
}

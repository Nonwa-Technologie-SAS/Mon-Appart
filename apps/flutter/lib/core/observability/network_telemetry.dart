import 'package:dio/dio.dart';

import 'telemetry_client.dart';
import 'telemetry_event.dart';
import 'telemetry_policy.dart';
import 'telemetry_redactor.dart';

/// Mesure méthode, chemin et durée. Jamais le corps, la query ni les jetons.
class NetworkTelemetryInterceptor extends Interceptor {
  NetworkTelemetryInterceptor(this._telemetry);

  final TelemetryClient _telemetry;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.extra['telemetryStartedAt'] = DateTime.now().toUtc();
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    _record(
      response.requestOptions,
      status: response.statusCode,
      errorType: null,
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _record(
      err.requestOptions,
      status: err.response?.statusCode,
      errorType: err.type.name,
    );
    handler.next(err);
  }

  void _record(
    RequestOptions options, {
    required int? status,
    required String? errorType,
  }) {
    try {
      final path = redactPath(options.uri.path);
      if (path.endsWith('/health/live')) {
        return;
      }
      final started = options.extra['telemetryStartedAt'];
      final elapsed = started is DateTime
          ? DateTime.now().toUtc().difference(started)
          : Duration.zero;
      final correlation = options.headers['X-Request-ID']?.toString();
      _telemetry.record(
        severity: _severity(
          status: status,
          errorType: errorType,
          elapsed: elapsed,
        ),
        kind: TelemetryKind.network,
        operation: 'http.${options.method.toUpperCase()}',
        message: 'Appel API ${options.method.toUpperCase()} $path',
        correlationId: correlation,
        attributes: {
          'path': path,
          'status': status,
          'elapsedMs': elapsed.inMilliseconds,
          'errorType': errorType,
          'overBudget': elapsed > TelemetryBudgets.slowRequest,
        },
      );
    } catch (_) {}
  }

  static TelemetrySeverity _severity({
    required int? status,
    required String? errorType,
    required Duration elapsed,
  }) {
    if (status == 401 || status == 403) {
      return TelemetrySeverity.low;
    }
    if (status != null && status >= 500) {
      return TelemetrySeverity.high;
    }
    if (status == 409) {
      return TelemetrySeverity.medium;
    }
    if (errorType == DioExceptionType.connectionTimeout.name ||
        errorType == DioExceptionType.receiveTimeout.name ||
        errorType == DioExceptionType.sendTimeout.name ||
        errorType == DioExceptionType.connectionError.name) {
      return TelemetrySeverity.medium;
    }
    if (status != null && status >= 400) {
      return TelemetrySeverity.medium;
    }
    if (elapsed > TelemetryBudgets.slowRequest) {
      return TelemetrySeverity.medium;
    }
    return TelemetrySeverity.low;
  }
}

import 'package:dio/dio.dart';

import 'app_failure.dart';

/// Convertit une [DioException] ou un corps JSON Nest en [AppFailure].
class ErrorMapper {
  const ErrorMapper();

  AppFailure fromDio(DioException error) {
    final requestId = _headerRequestId(error.response);

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return TimeoutFailure(requestId: requestId);
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        return NetworkFailure(requestId: requestId);
      case DioExceptionType.badCertificate:
        return const NetworkFailure(
          message: 'Le certificat TLS du serveur est invalide.',
          code: 'TLS_INVALID',
        );
      case DioExceptionType.badResponse:
        return fromResponse(error.response, fallbackRequestId: requestId);
      case DioExceptionType.cancel:
        return const UnexpectedFailure(
          message: 'La requête a été annulée.',
          code: 'REQUEST_CANCELLED',
        );
    }
  }

  AppFailure fromResponse(
    Response<dynamic>? response, {
    String? fallbackRequestId,
  }) {
    final status = response?.statusCode ?? 0;
    final payload = _asMap(response?.data);
    final code = _asString(payload?['code']);
    final message = _asString(payload?['message']);
    final requestId =
        _asString(payload?['requestId']) ??
        fallbackRequestId ??
        _headerRequestId(response);

    return HttpFailure(
      statusCode: status,
      code: code ?? _fallbackCode(status),
      message: message ?? _fallbackMessage(status),
      requestId: requestId,
    );
  }

  static Map<String, Object?>? _asMap(Object? data) {
    if (data is Map<String, Object?>) {
      return data;
    }
    if (data is Map) {
      return data.map((key, value) => MapEntry(key.toString(), value));
    }
    return null;
  }

  static String? _asString(Object? value) {
    if (value is String && value.trim().isNotEmpty) {
      return value;
    }
    return null;
  }

  static String? _headerRequestId(Response<dynamic>? response) {
    final value = response?.headers.value('x-request-id');
    if (value == null || value.isEmpty) {
      return null;
    }
    return value;
  }

  static String _fallbackCode(int status) {
    return switch (status) {
      400 => 'BAD_REQUEST',
      401 => 'UNAUTHENTICATED',
      403 => 'FORBIDDEN',
      404 => 'NOT_FOUND',
      409 => 'CONFLICT',
      429 => 'RATE_LIMITED',
      503 => 'SERVICE_UNAVAILABLE',
      _ when status >= 500 => 'INTERNAL_ERROR',
      _ => 'HTTP_ERROR',
    };
  }

  static String _fallbackMessage(int status) {
    return switch (status) {
      401 => 'Session expirée ou absente.',
      403 => 'Accès refusé.',
      404 => 'Ressource introuvable.',
      429 => 'Trop de requêtes, réessayez plus tard.',
      503 => 'Service temporairement indisponible.',
      _ when status >= 500 => 'Erreur interne du serveur.',
      _ => 'La requête a échoué.',
    };
  }
}

import 'package:dio/dio.dart';

import '../logging/app_logger.dart';
import '../logging/sensitive_data.dart';

/// Journalise méthode, chemin et statut. Jamais les jetons ni les mots de passe.
class LoggingInterceptor extends Interceptor {
  LoggingInterceptor(this._logger);

  final AppLogger _logger;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _logger.debug(
      'HTTP → ${options.method} ${options.uri.path} '
      'headers=${redactHeaders(options.headers)}',
    );
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    _logger.debug(
      'HTTP ← ${response.statusCode} ${response.requestOptions.uri.path}',
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _logger.debug(
      'HTTP ✕ ${err.response?.statusCode ?? err.type} '
      '${err.requestOptions.uri.path}',
    );
    handler.next(err);
  }
}

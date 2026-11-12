import 'package:dio/dio.dart';

import 'session_store.dart';
import 'token_refresher.dart';

/// Attache `Authorization: Bearer`. Renouvelle uniquement sur `TOKEN_EXPIRED`.
class AuthInterceptor extends Interceptor {
  AuthInterceptor(
    this._store, {
    required this.dio,
    this.refresher,
    this.onSessionCleared,
  });

  final SessionStore _store;
  final Dio dio;
  final TokenRefresher? refresher;
  final void Function()? onSessionCleared;

  static const _clearOnCodes = <String>{
    'TOKEN_EXPIRED',
    'TOKEN_INVALID',
    'SESSION_REVOKED',
    'UNAUTHENTICATED',
  };

  static const _skipRefreshPaths = <String>{
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
  };

  static const _doNotReplayPrefixes = <String>[
    '/api/v1/conversations',
    '/api/v1/appointments',
    '/api/v1/properties',
    '/api/v1/listings',
    '/api/v1/media/upload-sessions',
  ];

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _store.readAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (_shouldAttemptRefresh(err)) {
      final tokens = await refresher!.refresh();
      if (tokens != null) {
        if (_canReplay(err.requestOptions)) {
          final retried = await _replay(err.requestOptions, tokens.accessToken);
          handler.resolve(retried);
          return;
        }
        handler.next(err);
        return;
      }
    }
    if (_shouldClear(err)) {
      await _store.clear();
      onSessionCleared?.call();
    }
    handler.next(err);
  }

  bool _shouldAttemptRefresh(DioException err) {
    if (refresher == null) {
      return false;
    }
    if (err.requestOptions.extra['authRetried'] == true) {
      return false;
    }
    if (err.response?.statusCode != 401) {
      return false;
    }
    if (_codeOf(err) != 'TOKEN_EXPIRED') {
      return false;
    }
    final path = err.requestOptions.uri.path;
    return !_skipRefreshPaths.contains(path);
  }

  Future<Response<dynamic>> _replay(
    RequestOptions options,
    String accessToken,
  ) {
    options.headers['Authorization'] = 'Bearer $accessToken';
    options.extra['authRetried'] = true;
    return dio.fetch<dynamic>(options);
  }

  bool _canReplay(RequestOptions options) {
    final method = options.method.toUpperCase();
    if (method == 'GET' ||
        method == 'HEAD' ||
        method == 'DELETE' ||
        method == 'PUT' ||
        method == 'PATCH') {
      return true;
    }
    if (method != 'POST') {
      return false;
    }
    final path = options.uri.path;
    for (final prefix in _doNotReplayPrefixes) {
      if (path == prefix || path.startsWith('$prefix/')) {
        return false;
      }
    }
    return true;
  }

  bool _shouldClear(DioException err) {
    if (err.response?.statusCode != 401) {
      return false;
    }
    final code = _codeOf(err);
    if (code != null && code.isNotEmpty) {
      return _clearOnCodes.contains(code);
    }
    return true;
  }

  String? _codeOf(DioException err) {
    final data = err.response?.data;
    if (data is Map) {
      final code = data['code'];
      if (code is String && code.isNotEmpty) {
        return code;
      }
    }
    return null;
  }
}

import 'package:dio/dio.dart';

import '../../app/config/api_endpoints.dart';
import '../errors/error_mapper.dart';
import 'issued_auth.dart';
import 'session_store.dart';
import 'session_tokens.dart';

/// Rotation unique du refresh token. Réutilisation = révocation côté Nest.
class TokenRefresher {
  TokenRefresher({
    required this.store,
    required this.endpoints,
    Dio? dio,
    this.mapper = const ErrorMapper(),
  }) : _dio =
           dio ??
           Dio(
             BaseOptions(
               connectTimeout: const Duration(seconds: 10),
               sendTimeout: const Duration(seconds: 20),
               receiveTimeout: const Duration(seconds: 20),
               responseType: ResponseType.json,
               headers: const {'Accept': 'application/json'},
             ),
           );

  final SessionStore store;
  final ApiEndpoints endpoints;
  final ErrorMapper mapper;
  final Dio _dio;
  Future<SessionTokens?>? _inFlight;

  /// Un seul refresh à la fois : les appels suivants attendent le même Future.
  Future<SessionTokens?> refresh() {
    return _inFlight ??= _refresh().whenComplete(() => _inFlight = null);
  }

  Future<SessionTokens?> _refresh() async {
    final refreshToken = await store.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      return null;
    }
    try {
      final response = await _dio.post<Object?>(
        endpoints.authRefresh().toString(),
        data: {'refreshToken': refreshToken},
      );
      final issued = IssuedAuth.fromJson(_asMap(response.data));
      if (!issued.tokens.hasRefreshToken) {
        await store.clear();
        return null;
      }
      await store.save(issued.tokens);
      return issued.tokens;
    } on DioException catch (error) {
      final failure = mapper.fromDio(error);
      if (failure.statusCode == 401 || failure.statusCode == 403) {
        await store.clear();
        return null;
      }
      rethrow;
    } on FormatException {
      await store.clear();
      return null;
    }
  }

  Map<String, Object?> _asMap(Object? data) {
    if (data is Map<String, Object?>) {
      return data;
    }
    if (data is Map) {
      return data.map((key, value) => MapEntry(key.toString(), value));
    }
    throw const FormatException('Réponse de renouvellement inattendue.');
  }
}

// ignore_for_file: prefer_initializing_formals

import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../app/config/app_config.dart';
import '../auth/auth_interceptor.dart';
import '../auth/session_store.dart';
import '../auth/token_refresher.dart';
import '../errors/app_failure.dart';
import '../errors/error_mapper.dart';
import '../logging/app_logger.dart';
import '../network/logging_interceptor.dart';
import '../network/request_id.dart';
import 'api_client.dart';

class DioApiClient implements ApiClient {
  DioApiClient({
    required Dio dio,
    ErrorMapper mapper = const ErrorMapper(),
    Dio? binaryDio,
  }) : _dio = dio,
       _mapper = mapper,
       _binaryDio =
           binaryDio ??
           Dio(
             BaseOptions(
               connectTimeout: const Duration(seconds: 10),
               sendTimeout: const Duration(seconds: 120),
               receiveTimeout: const Duration(seconds: 30),
               followRedirects: true,
             ),
           );

  final Dio _dio;
  final Dio _binaryDio;
  final ErrorMapper _mapper;

  /// Délais explicites, TLS inchangé, JSON par défaut.
  factory DioApiClient.create({
    required AppConfig config,
    required SessionStore sessionStore,
    AppLogger? logger,
    TokenRefresher? refresher,
    void Function()? onSessionCleared,
  }) {
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        sendTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        responseType: ResponseType.json,
        headers: const {'Accept': 'application/json'},
      ),
    );
    dio.interceptors.add(
      AuthInterceptor(
        sessionStore,
        dio: dio,
        refresher: refresher,
        onSessionCleared: onSessionCleared,
      ),
    );
    final resolvedLogger =
        logger ?? AppLogger(enabled: config.enableNetworkLogs);
    if (resolvedLogger.enabled) {
      dio.interceptors.add(LoggingInterceptor(resolvedLogger));
    }
    return DioApiClient(dio: dio);
  }

  @override
  Future<Map<String, Object?>> getJson(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _send(
      () => _dio.get<Object?>(
        uri.toString(),
        queryParameters: query,
        options: Options(
          headers: {'X-Request-ID': createRequestId(), ...?headers},
        ),
      ),
    );
  }

  @override
  Future<List<Object?>> getJsonList(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _sendList(
      () => _dio.get<Object?>(
        uri.toString(),
        queryParameters: query,
        options: Options(
          headers: {'X-Request-ID': createRequestId(), ...?headers},
        ),
      ),
    );
  }

  @override
  Future<Map<String, Object?>> postJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _send(
      () => _dio.post<Object?>(
        uri.toString(),
        data: body,
        queryParameters: query,
        options: Options(
          headers: {'X-Request-ID': createRequestId(), ...?headers},
        ),
      ),
    );
  }

  @override
  Future<Map<String, Object?>> putJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _send(
      () => _dio.put<Object?>(
        uri.toString(),
        data: body,
        queryParameters: query,
        options: Options(
          headers: {'X-Request-ID': createRequestId(), ...?headers},
        ),
      ),
    );
  }

  @override
  Future<Map<String, Object?>> patchJson(
    Uri uri, {
    Map<String, Object?>? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _send(
      () => _dio.patch<Object?>(
        uri.toString(),
        data: body,
        queryParameters: query,
        options: Options(
          headers: {'X-Request-ID': createRequestId(), ...?headers},
        ),
      ),
    );
  }

  @override
  Future<Map<String, Object?>> deleteJson(
    Uri uri, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) {
    return _send(
      () => _dio.delete<Object?>(
        uri.toString(),
        queryParameters: query,
        options: Options(
          headers: {'X-Request-ID': createRequestId(), ...?headers},
        ),
      ),
    );
  }

  @override
  Future<void> putBytes(
    Uri uri, {
    required List<int> bytes,
    Map<String, String>? headers,
    void Function(int sent, int total)? onProgress,
  }) async {
    try {
      final response = await _binaryDio.put<Object?>(
        uri.toString(),
        data: Uint8List.fromList(bytes),
        options: Options(
          headers: headers,
          contentType: headers?['Content-Type'] ?? headers?['content-type'],
          responseType: ResponseType.bytes,
        ),
        onSendProgress: onProgress,
      );
      final status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        throw HttpFailure(
          statusCode: status,
          code: 'MEDIA_UPLOAD_FAILED',
          message: 'L\'envoi du fichier vers le stockage a échoué.',
        );
      }
    } on DioException catch (error) {
      throw _mapper.fromDio(error);
    } on AppFailure {
      rethrow;
    } catch (_) {
      throw const UnexpectedFailure();
    }
  }

  Future<Map<String, Object?>> _send(
    Future<Response<Object?>> Function() request,
  ) async {
    try {
      final response = await request();
      return _asJsonMap(response.data);
    } on DioException catch (error) {
      throw _mapper.fromDio(error);
    } on AppFailure {
      rethrow;
    } catch (_) {
      throw const UnexpectedFailure();
    }
  }

  Future<List<Object?>> _sendList(
    Future<Response<Object?>> Function() request,
  ) async {
    try {
      final response = await request();
      return _asJsonList(response.data);
    } on DioException catch (error) {
      throw _mapper.fromDio(error);
    } on AppFailure {
      rethrow;
    } catch (_) {
      throw const UnexpectedFailure();
    }
  }

  Map<String, Object?> _asJsonMap(Object? data) {
    if (data == null) {
      return const {};
    }
    if (data is Map<String, Object?>) {
      return data;
    }
    if (data is Map) {
      return data.map((key, value) => MapEntry(key.toString(), value));
    }
    throw const ParsingFailure();
  }

  List<Object?> _asJsonList(Object? data) {
    if (data is List) {
      return List<Object?>.from(data);
    }
    throw const ParsingFailure();
  }
}

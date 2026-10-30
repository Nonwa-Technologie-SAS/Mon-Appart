import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/errors/app_failure.dart';
import 'health_live.dart';

/// Sonde de connectivité : `GET /health/live` (processus API, sans Postgres).
class HealthRepository {
  HealthRepository({required this._client, required this._endpoints});

  final ApiClient _client;
  final ApiEndpoints _endpoints;

  Future<HealthLive> fetchLive() async {
    try {
      final json = await _client.getJson(_endpoints.healthLive());
      return HealthLive.fromJson(json);
    } on AppFailure {
      rethrow;
    } on FormatException catch (error) {
      throw ParsingFailure(message: error.message);
    }
  }
}

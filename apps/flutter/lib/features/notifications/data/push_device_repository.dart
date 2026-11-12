import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/public_ids.dart';
import '../domain/push_device.dart';

/// `POST` / `DELETE /push-devices`. Le jeton n'est jamais journalisé.
class PushDeviceRepository {
  PushDeviceRepository({required this.client, required this.endpoints});

  final ApiClient client;
  final ApiEndpoints endpoints;

  Future<PushDevice> register({
    required String token,
    required String platform,
  }) async {
    final trimmed = token.trim();
    if (trimmed.length < 16 || trimmed.length > 4096) {
      throw const HttpFailure(
        message: 'Jeton d\'appareil invalide.',
        code: 'INVALID_INPUT',
        statusCode: 400,
      );
    }
    final json = await client.postJson(
      endpoints.pushDevices(),
      body: {'token': trimmed, 'platform': platform},
    );
    final device = PushDevice.tryParse(json);
    if (device == null) {
      throw const ParsingFailure();
    }
    return device;
  }

  Future<void> unregister(String deviceId) async {
    final id = deviceId.trim();
    if (!PublicIds.isUuid(id)) {
      return;
    }
    await client.deleteJson(endpoints.pushDevice(id));
  }
}

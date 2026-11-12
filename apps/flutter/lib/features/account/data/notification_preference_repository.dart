import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../domain/notification_pref.dart';

class NotificationPreferenceRepository {
  NotificationPreferenceRepository({
    required this.client,
    required this.endpoints,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;

  Future<List<NotificationPrefCell>> list() async {
    final json = await client.getJson(endpoints.notificationPreferences());
    final raw = json['items'];
    if (raw is! List) {
      return const [];
    }
    return [for (final item in raw) ?NotificationPrefCell.tryParse(item)];
  }

  Future<List<NotificationPrefCell>> update(
    List<Map<String, Object?>> changes,
  ) async {
    final json = await client.putJson(
      endpoints.notificationPreferences(),
      body: {'items': changes},
    );
    final raw = json['items'];
    if (raw is! List) {
      return const [];
    }
    return [for (final item in raw) ?NotificationPrefCell.tryParse(item)];
  }
}

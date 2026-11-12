import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../domain/account_session.dart';

class AccountSessionRepository {
  AccountSessionRepository({required this.client, required this.endpoints});

  final ApiClient client;
  final ApiEndpoints endpoints;

  Future<List<AccountDeviceSession>> list() async {
    final raw = await client.getJsonList(endpoints.authSessions());
    return [for (final item in raw) ?AccountDeviceSession.tryParse(item)];
  }

  Future<void> revoke(String sessionId) async {
    await client.deleteJson(endpoints.authSession(sessionId));
  }
}

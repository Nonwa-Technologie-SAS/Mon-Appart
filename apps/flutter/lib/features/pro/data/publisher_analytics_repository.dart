import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/auth/session_store.dart';
import '../../../core/errors/app_failure.dart';
import '../domain/listing_stats.dart';

class PublisherAnalyticsRepository {
  PublisherAnalyticsRepository({
    required this.client,
    required this.endpoints,
    required this.sessionStore,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final SessionStore sessionStore;

  Future<ListingStatsPage> myListings({
    required DateTime from,
    required DateTime to,
  }) async {
    final token = await sessionStore.readAccessToken();
    if (token == null || token.isEmpty) {
      throw const NeedsAuthFailure();
    }
    final json = await client.getJson(
      endpoints.analyticsMeListings(),
      query: {'from': _day(from), 'to': _day(to), 'limit': '20', 'page': '1'},
    );
    try {
      return ListingStatsPage.parse(json);
    } on FormatException {
      throw const ParsingFailure(
        message: 'Statistiques d\'annonces inattendues.',
      );
    }
  }

  static String _day(DateTime value) {
    final utc = value.toUtc();
    final month = utc.month.toString().padLeft(2, '0');
    final day = utc.day.toString().padLeft(2, '0');
    return '${utc.year}-$month-$day';
  }
}

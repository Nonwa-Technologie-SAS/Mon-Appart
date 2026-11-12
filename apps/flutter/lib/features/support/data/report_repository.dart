import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/auth/session_store.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/public_ids.dart';
import '../domain/own_report.dart';

class ReportRepository {
  ReportRepository({
    required this.client,
    required this.endpoints,
    required this.sessionStore,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final SessionStore sessionStore;

  Future<List<OwnReport>> listOwn() async {
    await _requireSession();
    final json = await client.getJson(endpoints.trustReports());
    final items = json['items'];
    if (items is! List) {
      throw const ParsingFailure(message: 'Liste de signalements inattendue.');
    }
    final reports = <OwnReport>[];
    for (final item in items) {
      if (item is! Map) {
        throw const ParsingFailure(
          message: 'Liste de signalements inattendue.',
        );
      }
      final report = OwnReport.tryParse(Map<String, Object?>.from(item));
      if (report == null) {
        throw const ParsingFailure(
          message: 'Liste de signalements inattendue.',
        );
      }
      reports.add(report);
    }
    return reports;
  }

  Future<OwnReport> reportListing({
    required String listingId,
    required String reason,
    String? description,
  }) async {
    await _requireSession();
    if (!PublicIds.isUuid(listingId)) {
      throw const ParsingFailure(message: 'Annonce invalide.');
    }
    if (!ListingReportReasons.values.contains(reason)) {
      throw const ParsingFailure(message: 'Motif de signalement invalide.');
    }
    final trimmed = description?.trim();
    final json = await client.postJson(
      endpoints.trustReports(),
      body: {
        'targetType': 'LISTING',
        'listingId': listingId,
        'reason': reason,
        if (trimmed != null && trimmed.isNotEmpty)
          'description': trimmed.length > 1000
              ? trimmed.substring(0, 1000)
              : trimmed,
      },
    );
    final report = OwnReport.tryParse(json);
    if (report == null) {
      throw const ParsingFailure(message: 'Réponse de signalement inattendue.');
    }
    return report;
  }

  Future<void> _requireSession() async {
    final token = await sessionStore.readAccessToken();
    if (token == null || token.isEmpty) {
      throw const NeedsAuthFailure();
    }
  }
}

import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/cursor_page.dart';
import '../../../core/auth/session_store.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/public_ids.dart';
import '../domain/inquiry.dart';
import '../domain/inquiry_dashboard.dart';

class InquiryRepository {
  InquiryRepository({
    required this.client,
    required this.endpoints,
    required this.sessionStore,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final SessionStore sessionStore;

  Future<void> _requireSession() async {
    final token = await sessionStore.readAccessToken();
    if (token == null || token.isEmpty) {
      throw const NeedsAuthFailure();
    }
  }

  Future<InquiryDashboard> dashboard() async {
    await _requireSession();
    final json = await client.getJson(endpoints.inquiriesDashboard());
    try {
      return InquiryDashboard.parse(json);
    } on FormatException {
      throw const ParsingFailure(
        message: 'Tableau de bord commercial inattendu.',
      );
    }
  }

  Future<CursorPage<Inquiry>> list({
    String? cursor,
    String? stage,
    String? status,
    String? q,
    int take = 30,
  }) async {
    await _requireSession();
    final json = await client.getJson(
      endpoints.inquiries(),
      query: {
        'take': '$take',
        if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
        if (stage != null && stage.isNotEmpty) 'stage': stage,
        if (status != null && status.isNotEmpty) 'status': status,
        if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
      },
    );
    try {
      return CursorPage.fromJson(json, Inquiry.parse);
    } on FormatException {
      throw const ParsingFailure(message: 'Liste de demandes inattendue.');
    }
  }

  Future<Inquiry> getById(String inquiryId) async {
    await _requireSession();
    if (!PublicIds.isUuid(inquiryId)) {
      throw const InvalidInquiryIdFailure();
    }
    try {
      final json = await client.getJson(endpoints.inquiry(inquiryId));
      return Inquiry.parse(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw InquiryUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    } on FormatException {
      throw const ParsingFailure(message: 'Fiche demande inattendue.');
    }
  }

  Future<Inquiry> updateStage({
    required String inquiryId,
    required String stage,
    String? lostReason,
  }) async {
    await _requireSession();
    if (!PublicIds.isUuid(inquiryId)) {
      throw const InvalidInquiryIdFailure();
    }
    try {
      final json = await client.patchJson(
        endpoints.inquiry(inquiryId),
        body: {
          'stage': stage,
          if (lostReason != null && lostReason.isNotEmpty)
            'lostReason': lostReason,
        },
      );
      return Inquiry.parse(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw InquiryUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    } on FormatException {
      throw const ParsingFailure(message: 'Mise à jour de demande inattendue.');
    }
  }

  Future<Inquiry> addNote({
    required String inquiryId,
    required String body,
  }) async {
    await _requireSession();
    if (!PublicIds.isUuid(inquiryId)) {
      throw const InvalidInquiryIdFailure();
    }
    final text = body.trim();
    if (text.length < 2) {
      throw const InquiryValidationFailure('La note est trop courte.');
    }
    try {
      final json = await client.postJson(
        endpoints.inquiryNotes(inquiryId),
        body: {'body': text},
      );
      return Inquiry.parse(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw InquiryUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    } on FormatException {
      throw const ParsingFailure(message: 'Note interne inattendue.');
    }
  }
}

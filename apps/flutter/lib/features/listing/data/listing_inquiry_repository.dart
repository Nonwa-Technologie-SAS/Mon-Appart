import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/auth/session_store.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/ids/uuid_v4.dart';
import '../../messaging/domain/conversation.dart';
import '../../visits/domain/visit.dart';
import '../../visits/domain/visit_rules.dart';

abstract final class InquiryRules {
  static const maxMessageLength = 4000;
  static const maxNotesLength = 1000;

  static String? messageError(String raw) {
    final text = raw.trim();
    if (text.isEmpty) {
      return 'Saisissez un message pour l\'annonceur.';
    }
    if (text.length > maxMessageLength) {
      return 'Le message est trop long.';
    }
    return null;
  }

  static String? scheduleError(DateTime? scheduledAt, {DateTime? now}) {
    return VisitRules.scheduleError(scheduledAt, now: now);
  }

  static String? notesError(String raw) {
    if (raw.trim().length > maxNotesLength) {
      return 'La note est trop longue.';
    }
    return null;
  }
}

class ListingInquiryRepository {
  ListingInquiryRepository({
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

  Future<StartConversationResult> contact({
    required String listingId,
    required String message,
    String? clientMessageId,
  }) async {
    await _requireSession();
    final error = InquiryRules.messageError(message);
    if (error != null) {
      throw InquiryValidationFailure(error);
    }
    final json = await client.postJson(
      endpoints.conversations(),
      body: {
        'listingId': listingId,
        'message': message.trim(),
        'clientMessageId': clientMessageId ?? UuidV4.generate(),
      },
    );
    try {
      return StartConversationResult.parse(json);
    } on FormatException {
      throw const ParsingFailure(
        message: 'Réponse de création de conversation inattendue.',
      );
    }
  }

  Future<Visit> requestVisit({
    required String listingId,
    required DateTime scheduledAt,
    String notes = '',
    DateTime? now,
  }) async {
    await _requireSession();
    final scheduleError = InquiryRules.scheduleError(scheduledAt, now: now);
    if (scheduleError != null) {
      throw InquiryValidationFailure(scheduleError);
    }
    final notesError = InquiryRules.notesError(notes);
    if (notesError != null) {
      throw InquiryValidationFailure(notesError);
    }
    final json = await client.postJson(
      endpoints.appointments(),
      body: {
        'listingId': listingId,
        'scheduledAt': scheduledAt.toUtc().toIso8601String(),
        'timezone': VisitRules.timezone,
        if (notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
    try {
      return Visit.parse(json);
    } on FormatException {
      throw const ParsingFailure(
        message: 'Réponse de demande de visite inattendue.',
      );
    }
  }
}

import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/auth/session_store.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';
import '../../../core/offline/cache_read.dart';
import '../../../core/offline/cached_envelope.dart';
import '../../../core/offline/offline_cache.dart';
import '../domain/visit.dart';
import '../domain/visit_rules.dart';
import '../domain/visits_snapshot.dart';

class VisitRepository {
  VisitRepository({
    required this.client,
    required this.endpoints,
    required this.sessionStore,
    this.cache,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final SessionStore sessionStore;
  final OfflineCache? cache;

  Future<void> _requireSession() async {
    final token = await sessionStore.readAccessToken();
    if (token == null || token.isEmpty) {
      throw const NeedsAuthFailure();
    }
  }

  void _requireId(String appointmentId) {
    if (!PublicIds.isUuid(appointmentId)) {
      throw const InvalidAppointmentIdFailure();
    }
  }

  Future<VisitRequestResult> request({
    required String listingId,
    required DateTime scheduledAt,
    String notes = '',
    DateTime? now,
  }) async {
    await _requireSession();
    if (!PublicIds.isUuid(listingId)) {
      throw const InvalidListingIdFailure();
    }
    final scheduleError = VisitRules.scheduleError(scheduledAt, now: now);
    if (scheduleError != null) {
      throw InquiryValidationFailure(scheduleError);
    }
    final notesError = VisitRules.notesError(notes);
    if (notesError != null) {
      throw InquiryValidationFailure(notesError);
    }
    try {
      final json = await client.postJson(
        endpoints.appointments(),
        body: {
          'listingId': listingId,
          'scheduledAt': scheduledAt.toUtc().toIso8601String(),
          'timezone': VisitRules.timezone,
          if (notes.trim().isNotEmpty) 'notes': notes.trim(),
        },
      );
      return VisitRequestResult(visit: _parse(json));
    } on HttpFailure catch (error) {
      if (error.code == 'APPOINTMENT_ALREADY_ACTIVE' ||
          error.statusCode == 409) {
        final existing = await findUpcomingForListing(listingId);
        throw AppointmentAlreadyActiveFailure(
          existingId: existing?.id,
          requestId: error.requestId,
        );
      }
      rethrow;
    } on TimeoutFailure {
      final existing = await findUpcomingForListing(listingId);
      if (existing != null) {
        return VisitRequestResult(visit: existing, alreadyExisted: true);
      }
      rethrow;
    } on FormatException {
      throw const ParsingFailure(
        message: 'Réponse de demande de visite inattendue.',
      );
    }
  }

  Future<List<Visit>> list({
    required VisitListScope scope,
    int limit = 50,
  }) async {
    final read = await readList(scope: scope, limit: limit);
    return read.value;
  }

  Future<CachedRead<List<Visit>>> readList({
    required VisitListScope scope,
    int limit = 50,
  }) async {
    await _requireSession();
    final scopeKey = scope == VisitListScope.past ? 'past' : 'upcoming';
    final local = cache;
    final userId = asNonEmptyString((await local?.getProfile())?.payload['id']);
    try {
      if (local == null || userId == null) {
        final json = await client.getJson(
          endpoints.appointments(),
          query: {'scope': scopeKey, 'limit': '$limit'},
        );
        return CachedRead(
          value: Visit.parseItems(json),
          fetchedAt: DateTime.now().toUtc(),
          fromCache: false,
        );
      }
      return await readThroughCache(
        remote: () => client.getJson(
          endpoints.appointments(),
          query: {'scope': scopeKey, 'limit': '$limit'},
        ),
        persist: (json) => local.putVisits(userId, scopeKey, json),
        local: () => local.getVisits(userId, scopeKey),
        parse: Visit.parseItems,
        now: () => local.now,
      );
    } on FormatException {
      throw const ParsingFailure(message: 'Liste de visites inattendue.');
    }
  }

  Future<Visit> getById(String appointmentId) async {
    final read = await readById(appointmentId);
    return read.value;
  }

  Future<CachedRead<Visit>> readById(String appointmentId) async {
    await _requireSession();
    _requireId(appointmentId);
    final local = cache;
    final userId = asNonEmptyString((await local?.getProfile())?.payload['id']);
    try {
      if (local == null || userId == null) {
        final json = await client.getJson(endpoints.appointment(appointmentId));
        return CachedRead(
          value: _parse(json),
          fetchedAt: DateTime.now().toUtc(),
          fromCache: false,
        );
      }
      return await readThroughCache(
        remote: () => client.getJson(endpoints.appointment(appointmentId)),
        persist: (json) => local.putVisit(userId, appointmentId, json),
        local: () => local.getVisit(userId, appointmentId),
        parse: _parse,
        now: () => local.now,
      );
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw AppointmentUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Future<Visit> confirm(String appointmentId) {
    return _postAction(
      appointmentId,
      endpoints.appointmentConfirm(appointmentId),
    );
  }

  Future<Visit> reschedule(String appointmentId, DateTime scheduledAt) async {
    await _requireSession();
    _requireId(appointmentId);
    final scheduleError = VisitRules.scheduleError(scheduledAt);
    if (scheduleError != null) {
      throw InquiryValidationFailure(scheduleError);
    }
    try {
      final json = await client.postJson(
        endpoints.appointmentReschedule(appointmentId),
        body: {'scheduledAt': scheduledAt.toUtc().toIso8601String()},
      );
      return _parse(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw AppointmentUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Future<Visit> cancel(String appointmentId, String reason) async {
    await _requireSession();
    _requireId(appointmentId);
    try {
      final json = await client.postJson(
        endpoints.appointmentCancel(appointmentId),
        body: {'reason': reason},
      );
      return _parse(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw AppointmentUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Future<Visit> complete(String appointmentId) {
    return _postAction(
      appointmentId,
      endpoints.appointmentComplete(appointmentId),
    );
  }

  Future<Visit> noShow(String appointmentId) {
    return _postAction(
      appointmentId,
      endpoints.appointmentNoShow(appointmentId),
    );
  }

  Future<Visit> submitFeedback({
    required String appointmentId,
    required String outcome,
    bool shareOutcomeWithOwner = false,
  }) async {
    await _requireSession();
    _requireId(appointmentId);
    try {
      final json = await client.postJson(
        endpoints.appointmentFeedback(appointmentId),
        body: {
          'outcome': outcome,
          'shareOutcomeWithOwner': shareOutcomeWithOwner,
        },
      );
      return _parse(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw AppointmentUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Future<Visit?> findUpcomingForListing(String listingId) async {
    final items = await list(scope: VisitListScope.upcoming, limit: 100);
    for (final visit in items) {
      if (visit.listingId == listingId) {
        return visit;
      }
    }
    return null;
  }

  Future<Visit> _postAction(String appointmentId, Uri uri) async {
    await _requireSession();
    _requireId(appointmentId);
    try {
      return _parse(await client.postJson(uri));
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw AppointmentUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Visit _parse(Map<String, Object?> json) {
    try {
      return Visit.parse(json);
    } on FormatException {
      throw const ParsingFailure(message: 'Réponse de visite inattendue.');
    }
  }
}

import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';
import '../../messaging/domain/chat_message.dart';

class VisitFeedback {
  const VisitFeedback({required this.submitted, this.outcome});

  final bool submitted;
  final String? outcome;

  static VisitFeedback parse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return const VisitFeedback(submitted: false);
    }
    return VisitFeedback(
      submitted: json['submitted'] == true,
      outcome: asNonEmptyString(json['outcome']),
    );
  }
}

class Visit {
  const Visit({
    required this.id,
    required this.status,
    required this.side,
    required this.scheduledAt,
    required this.timezone,
    required this.durationMinutes,
    required this.listingId,
    required this.listingTitle,
    required this.requester,
    required this.actions,
    required this.createdAt,
    required this.feedback,
    this.notes,
    this.proposedAt,
    this.proposedBy,
    this.conversationId,
    this.confirmedAt,
    this.cancelledAt,
    this.cancelledBy,
    this.cancellationReason,
    this.completedAt,
  });

  final String id;
  final String status;
  final String side;
  final DateTime scheduledAt;
  final String timezone;
  final int durationMinutes;
  final String? notes;
  final DateTime? proposedAt;
  final String? proposedBy;
  final String listingId;
  final String listingTitle;
  final String? conversationId;
  final ConversationPerson requester;
  final DateTime? confirmedAt;
  final DateTime? cancelledAt;
  final String? cancelledBy;
  final String? cancellationReason;
  final DateTime? completedAt;
  final DateTime createdAt;
  final List<String> actions;
  final VisitFeedback feedback;

  bool get isRequester => side == 'REQUESTER';

  bool can(String action) => actions.contains(action);

  bool get canSubmitFeedback =>
      status == 'COMPLETED' && isRequester && !feedback.submitted;

  Visit copyWith({
    String? status,
    DateTime? scheduledAt,
    List<String>? actions,
    VisitFeedback? feedback,
    DateTime? proposedAt,
    String? proposedBy,
    DateTime? confirmedAt,
    DateTime? cancelledAt,
    String? cancellationReason,
    DateTime? completedAt,
  }) {
    return Visit(
      id: id,
      status: status ?? this.status,
      side: side,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      timezone: timezone,
      durationMinutes: durationMinutes,
      notes: notes,
      proposedAt: proposedAt ?? this.proposedAt,
      proposedBy: proposedBy ?? this.proposedBy,
      listingId: listingId,
      listingTitle: listingTitle,
      conversationId: conversationId,
      requester: requester,
      confirmedAt: confirmedAt ?? this.confirmedAt,
      cancelledAt: cancelledAt ?? this.cancelledAt,
      cancelledBy: cancelledBy,
      cancellationReason: cancellationReason ?? this.cancellationReason,
      completedAt: completedAt ?? this.completedAt,
      createdAt: createdAt,
      actions: actions ?? this.actions,
      feedback: feedback ?? this.feedback,
    );
  }

  static Visit? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final scheduledAt = DateTime.tryParse(
      asNonEmptyString(json['scheduledAt']) ?? '',
    );
    final listing = asJsonMapOrNull(json['listing']);
    final listingId = asNonEmptyString(listing?['id']);
    final listingTitle = asNonEmptyString(listing?['title']);
    final requester = ConversationPerson.tryParse(json['requester']);
    if (id == null ||
        !PublicIds.isUuid(id) ||
        scheduledAt == null ||
        listingId == null ||
        !PublicIds.isUuid(listingId) ||
        listingTitle == null ||
        requester == null) {
      return null;
    }
    final conversationId = asNonEmptyString(json['conversationId']);
    final rawActions = json['actions'];
    return Visit(
      id: id,
      status: asNonEmptyString(json['status']) ?? 'PENDING',
      side: asNonEmptyString(json['side']) ?? 'REQUESTER',
      scheduledAt: scheduledAt,
      timezone: asNonEmptyString(json['timezone']) ?? 'Africa/Abidjan',
      durationMinutes: asInt(json['durationMinutes']) ?? 60,
      notes: asNonEmptyString(json['notes']),
      proposedAt: DateTime.tryParse(asNonEmptyString(json['proposedAt']) ?? ''),
      proposedBy: asNonEmptyString(json['proposedBy']),
      listingId: listingId,
      listingTitle: listingTitle,
      conversationId: conversationId != null && PublicIds.isUuid(conversationId)
          ? conversationId
          : null,
      requester: requester,
      confirmedAt: DateTime.tryParse(
        asNonEmptyString(json['confirmedAt']) ?? '',
      ),
      cancelledAt: DateTime.tryParse(
        asNonEmptyString(json['cancelledAt']) ?? '',
      ),
      cancelledBy: asNonEmptyString(json['cancelledBy']),
      cancellationReason: asNonEmptyString(json['cancellationReason']),
      completedAt: DateTime.tryParse(
        asNonEmptyString(json['completedAt']) ?? '',
      ),
      createdAt:
          DateTime.tryParse(asNonEmptyString(json['createdAt']) ?? '') ??
          scheduledAt,
      actions: rawActions is List
          ? [
              for (final item in rawActions)
                if (item is String && item.isNotEmpty) item,
            ]
          : const [],
      feedback: VisitFeedback.parse(json['feedback']),
    );
  }

  static Visit parse(Map<String, Object?> json) {
    final visit = tryParse(json);
    if (visit == null) {
      throw const FormatException('Réponse de visite inattendue.');
    }
    return visit;
  }

  static List<Visit> parseItems(Map<String, Object?> json) {
    final raw = json['items'];
    if (raw is! List) {
      throw const FormatException('Liste de visites inattendue.');
    }
    return [for (final item in raw) ?Visit.tryParse(item)];
  }
}

class VisitRequestResult {
  const VisitRequestResult({required this.visit, this.alreadyExisted = false});

  final Visit visit;
  final bool alreadyExisted;
}

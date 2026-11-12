import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';

class InquiryPerson {
  const InquiryPerson({required this.id, required this.displayName});

  final String id;
  final String displayName;

  static InquiryPerson? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final displayName = asNonEmptyString(json['displayName']);
    if (id == null || !PublicIds.isUuid(id) || displayName == null) {
      return null;
    }
    return InquiryPerson(id: id, displayName: displayName);
  }
}

class InquiryAppointmentRef {
  const InquiryAppointmentRef({
    required this.id,
    required this.status,
    required this.scheduledAt,
  });

  final String id;
  final String status;
  final DateTime scheduledAt;
}

class InquiryNote {
  const InquiryNote({
    required this.id,
    required this.body,
    required this.createdAt,
    required this.authorName,
  });

  final String id;
  final String body;
  final DateTime createdAt;
  final String authorName;
}

class InquiryStageEvent {
  const InquiryStageEvent({
    required this.toStage,
    required this.createdAt,
    required this.authorName,
    this.fromStage,
    this.reason,
  });

  final String? fromStage;
  final String toStage;
  final String? reason;
  final DateTime createdAt;
  final String authorName;
}

class Inquiry {
  const Inquiry({
    required this.id,
    required this.type,
    required this.status,
    required this.stage,
    required this.createdAt,
    required this.lastActivityAt,
    required this.prospect,
    required this.listingId,
    required this.listingTitle,
    required this.listingType,
    required this.listingStatus,
    required this.appointments,
    required this.priority,
    required this.suggestedAction,
    this.nextAction,
    this.nextActionAt,
    this.budgetAmount,
    this.conversationId,
    this.message,
    this.desiredZone,
    this.lostReason,
    this.notes = const [],
    this.stageHistory = const [],
  });

  final String id;
  final String type;
  final String status;
  final String stage;
  final DateTime createdAt;
  final DateTime lastActivityAt;
  final String? nextAction;
  final DateTime? nextActionAt;
  final int? budgetAmount;
  final InquiryPerson prospect;
  final String listingId;
  final String listingTitle;
  final String listingType;
  final String listingStatus;
  final String? conversationId;
  final List<InquiryAppointmentRef> appointments;
  final String priority;
  final String suggestedAction;
  final String? message;
  final String? desiredZone;
  final String? lostReason;
  final List<InquiryNote> notes;
  final List<InquiryStageEvent> stageHistory;

  static Inquiry? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final listing = asJsonMapOrNull(json['listing']);
    final listingId = asNonEmptyString(listing?['id']);
    final listingTitle = asNonEmptyString(listing?['title']);
    final prospect = InquiryPerson.tryParse(json['prospect']);
    final createdAt = DateTime.tryParse(
      asNonEmptyString(json['createdAt']) ?? '',
    );
    if (id == null ||
        !PublicIds.isUuid(id) ||
        listingId == null ||
        !PublicIds.isUuid(listingId) ||
        listingTitle == null ||
        prospect == null ||
        createdAt == null) {
      return null;
    }
    final conversationId = asNonEmptyString(json['conversationId']);
    final rawAppointments = json['appointments'];
    final rawNotes = json['notes'];
    final rawHistory = json['stageHistory'];
    return Inquiry(
      id: id,
      type: asNonEmptyString(json['type']) ?? 'CONTACT',
      status: asNonEmptyString(json['status']) ?? 'OPEN',
      stage: asNonEmptyString(json['stage']) ?? 'NEW',
      createdAt: createdAt,
      lastActivityAt:
          DateTime.tryParse(asNonEmptyString(json['lastActivityAt']) ?? '') ??
          createdAt,
      nextAction: asNonEmptyString(json['nextAction']),
      nextActionAt: DateTime.tryParse(
        asNonEmptyString(json['nextActionAt']) ?? '',
      ),
      budgetAmount: asInt(json['budgetAmount']),
      prospect: prospect,
      listingId: listingId,
      listingTitle: listingTitle,
      listingType: asNonEmptyString(listing?['listingType']) ?? 'RENT',
      listingStatus: asNonEmptyString(listing?['status']) ?? 'PUBLISHED',
      conversationId: conversationId != null && PublicIds.isUuid(conversationId)
          ? conversationId
          : null,
      appointments: rawAppointments is List
          ? [for (final item in rawAppointments) ?_appointment(item)]
          : const [],
      priority: asNonEmptyString(json['priority']) ?? 'MEDIUM',
      suggestedAction: asNonEmptyString(json['suggestedAction']) ?? '',
      message: asNonEmptyString(json['message']),
      desiredZone: asNonEmptyString(json['desiredZone']),
      lostReason: asNonEmptyString(json['lostReason']),
      notes: rawNotes is List
          ? [for (final item in rawNotes) ?_note(item)]
          : const [],
      stageHistory: rawHistory is List
          ? [for (final item in rawHistory) ?_history(item)]
          : const [],
    );
  }

  static Inquiry parse(Map<String, Object?> json) {
    final inquiry = tryParse(json);
    if (inquiry == null) {
      throw const FormatException('Réponse de demande inattendue.');
    }
    return inquiry;
  }

  static InquiryAppointmentRef? _appointment(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final scheduledAt = DateTime.tryParse(
      asNonEmptyString(json['scheduledAt']) ?? '',
    );
    if (id == null || !PublicIds.isUuid(id) || scheduledAt == null) {
      return null;
    }
    return InquiryAppointmentRef(
      id: id,
      status: asNonEmptyString(json['status']) ?? 'PENDING',
      scheduledAt: scheduledAt,
    );
  }

  static InquiryNote? _note(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final body = asNonEmptyString(json['body']);
    final createdAt = DateTime.tryParse(
      asNonEmptyString(json['createdAt']) ?? '',
    );
    final author = asJsonMapOrNull(json['author']);
    if (id == null || body == null || createdAt == null) {
      return null;
    }
    return InquiryNote(
      id: id,
      body: body,
      createdAt: createdAt,
      authorName: asNonEmptyString(author?['displayName']) ?? 'Équipe',
    );
  }

  static InquiryStageEvent? _history(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final toStage = asNonEmptyString(json['toStage']);
    final createdAt = DateTime.tryParse(
      asNonEmptyString(json['createdAt']) ?? '',
    );
    final author = asJsonMapOrNull(json['author']);
    if (toStage == null || createdAt == null) {
      return null;
    }
    return InquiryStageEvent(
      fromStage: asNonEmptyString(json['fromStage']),
      toStage: toStage,
      reason: asNonEmptyString(json['reason']),
      createdAt: createdAt,
      authorName: asNonEmptyString(author?['displayName']) ?? 'Équipe',
    );
  }
}

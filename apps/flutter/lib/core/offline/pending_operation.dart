import '../ids/uuid_v4.dart';
import '../json/json_map.dart';
import 'offline_json.dart';

enum PendingOpType { favoriteAdd, favoriteRemove, preferencesPut }

enum PendingOpStatus {
  pending,
  running,
  synced,
  failedTemporary,
  failedPermanent,
  cancelled,
}

class PendingOperation {
  const PendingOperation({
    required this.id,
    required this.userId,
    required this.type,
    required this.entityId,
    required this.payload,
    required this.createdAt,
    required this.status,
    this.lastAttemptAt,
    this.nextAttemptAt,
    this.attempts = 0,
    this.lastError,
  });

  final String id;
  final String userId;
  final PendingOpType type;
  final String entityId;
  final Map<String, Object?> payload;
  final DateTime createdAt;
  final DateTime? lastAttemptAt;
  final DateTime? nextAttemptAt;
  final int attempts;
  final PendingOpStatus status;
  final String? lastError;

  bool get isOpen =>
      status == PendingOpStatus.pending ||
      status == PendingOpStatus.running ||
      status == PendingOpStatus.failedTemporary;

  bool get isFailed =>
      status == PendingOpStatus.failedTemporary ||
      status == PendingOpStatus.failedPermanent;

  String get coalescingKey => '${type.name}:$entityId';

  PendingOperation copyWith({
    PendingOpStatus? status,
    DateTime? lastAttemptAt,
    DateTime? nextAttemptAt,
    int? attempts,
    String? lastError,
    bool clearError = false,
  }) {
    return PendingOperation(
      id: id,
      userId: userId,
      type: type,
      entityId: entityId,
      payload: payload,
      createdAt: createdAt,
      status: status ?? this.status,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      attempts: attempts ?? this.attempts,
      lastError: clearError ? null : (lastError ?? this.lastError),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'userId': userId,
      'type': type.name,
      'entityId': entityId,
      'payload': payload,
      'createdAt': createdAt.toUtc().toIso8601String(),
      'lastAttemptAt': lastAttemptAt?.toUtc().toIso8601String(),
      'nextAttemptAt': nextAttemptAt?.toUtc().toIso8601String(),
      'attempts': attempts,
      'status': status.name,
      'lastError': lastError,
    };
  }

  String encode() => encodeJsonObject(toJson());

  static PendingOperation? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final userId = asNonEmptyString(json['userId']);
    final entityId = asNonEmptyString(json['entityId']);
    final createdAt = DateTime.tryParse(
      asNonEmptyString(json['createdAt']) ?? '',
    );
    final type = _type(asNonEmptyString(json['type']));
    final status = _status(asNonEmptyString(json['status']));
    if (id == null ||
        userId == null ||
        entityId == null ||
        createdAt == null ||
        type == null ||
        status == null) {
      return null;
    }
    return PendingOperation(
      id: id,
      userId: userId,
      type: type,
      entityId: entityId,
      payload: asJsonMapOrNull(json['payload']) ?? const {},
      createdAt: createdAt.toUtc(),
      lastAttemptAt: DateTime.tryParse(
        asNonEmptyString(json['lastAttemptAt']) ?? '',
      )?.toUtc(),
      nextAttemptAt: DateTime.tryParse(
        asNonEmptyString(json['nextAttemptAt']) ?? '',
      )?.toUtc(),
      attempts: asInt(json['attempts']) ?? 0,
      status: status,
      lastError: asNonEmptyString(json['lastError']),
    );
  }

  static PendingOperation create({
    required String userId,
    required PendingOpType type,
    required String entityId,
    Map<String, Object?> payload = const {},
    required DateTime now,
    String Function()? idFactory,
  }) {
    return PendingOperation(
      id: idFactory?.call() ?? UuidV4.generate(),
      userId: userId,
      type: type,
      entityId: entityId,
      payload: payload,
      createdAt: now.toUtc(),
      nextAttemptAt: now.toUtc(),
      status: PendingOpStatus.pending,
    );
  }

  static PendingOpType? _type(String? raw) {
    return switch (raw) {
      'favoriteAdd' => PendingOpType.favoriteAdd,
      'favoriteRemove' => PendingOpType.favoriteRemove,
      'preferencesPut' => PendingOpType.preferencesPut,
      _ => null,
    };
  }

  static PendingOpStatus? _status(String? raw) {
    return switch (raw) {
      'pending' => PendingOpStatus.pending,
      'running' => PendingOpStatus.running,
      'synced' => PendingOpStatus.synced,
      'failedTemporary' => PendingOpStatus.failedTemporary,
      'failedPermanent' => PendingOpStatus.failedPermanent,
      'cancelled' => PendingOpStatus.cancelled,
      _ => null,
    };
  }
}

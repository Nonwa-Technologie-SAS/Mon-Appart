import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';

class InboxNotification {
  const InboxNotification({
    required this.id,
    required this.type,
    required this.category,
    required this.title,
    required this.body,
    required this.createdAt,
    this.data = const {},
    this.readAt,
  });

  final String id;
  final String type;
  final String category;
  final String title;
  final String body;
  final DateTime createdAt;
  final Map<String, Object?> data;
  final DateTime? readAt;

  bool get isRead => readAt != null;

  String? get listingId {
    final direct = _uuid(asNonEmptyString(data['listingId']));
    if (direct != null) {
      return direct;
    }
    final ids = data['listingIds'];
    if (ids is List && ids.length == 1) {
      return _uuid(asNonEmptyString(ids.first));
    }
    return null;
  }

  String? get savedSearchId => _uuid(asNonEmptyString(data['savedSearchId']));

  String? get conversationId => _uuid(asNonEmptyString(data['conversationId']));

  String? get appointmentId => _uuid(asNonEmptyString(data['appointmentId']));

  InboxNotification copyWith({DateTime? readAt}) {
    return InboxNotification(
      id: id,
      type: type,
      category: category,
      title: title,
      body: body,
      createdAt: createdAt,
      data: data,
      readAt: readAt ?? this.readAt,
    );
  }

  static String? _uuid(String? value) {
    if (value == null || !PublicIds.isUuid(value)) {
      return null;
    }
    return value;
  }

  static InboxNotification? tryParse(Object? raw) {
    if (raw is! Map) {
      return null;
    }
    final json = asJsonMap(raw);
    final id = asNonEmptyString(json['id']);
    final title = asNonEmptyString(json['title']);
    if (id == null || title == null) {
      return null;
    }
    return InboxNotification(
      id: id,
      type: asNonEmptyString(json['type']) ?? 'SYSTEM',
      category: asNonEmptyString(json['category']) ?? 'SYSTEM',
      title: title,
      body: asNonEmptyString(json['body']) ?? '',
      createdAt:
          DateTime.tryParse(asNonEmptyString(json['createdAt']) ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      data: json['data'] is Map ? asJsonMap(json['data']) : const {},
      readAt: DateTime.tryParse(asNonEmptyString(json['readAt']) ?? ''),
    );
  }
}

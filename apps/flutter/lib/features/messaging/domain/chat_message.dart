import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';

class ConversationPerson {
  const ConversationPerson({
    this.id,
    required this.role,
    required this.displayName,
  });

  final String? id;
  final String role;
  final String displayName;

  bool get isListingSide => role == 'LISTING_SIDE';

  static ConversationPerson? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final displayName = asNonEmptyString(json['displayName']);
    if (displayName == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    return ConversationPerson(
      id: id != null && PublicIds.isUuid(id) ? id : null,
      role: asNonEmptyString(json['role']) ?? 'REQUESTER',
      displayName: displayName,
    );
  }
}

class MessageAttachment {
  const MessageAttachment({
    required this.id,
    required this.type,
    required this.mimeType,
    required this.size,
    required this.ready,
    this.filename,
  });

  final String id;
  final String type;
  final String mimeType;
  final int size;
  final bool ready;
  final String? filename;

  String get label {
    if (filename != null && filename!.isNotEmpty) {
      return filename!;
    }
    return type == 'IMAGE' ? 'Image' : 'Document';
  }

  static MessageAttachment? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    if (id == null || !PublicIds.isUuid(id)) {
      return null;
    }
    return MessageAttachment(
      id: id,
      type: asNonEmptyString(json['type']) ?? 'DOCUMENT',
      mimeType:
          asNonEmptyString(json['mimeType']) ?? 'application/octet-stream',
      size: asInt(json['size']) ?? 0,
      ready: json['ready'] == true,
      filename: asNonEmptyString(json['filename']),
    );
  }
}

class MessageSafetyHint {
  const MessageSafetyHint({
    required this.code,
    required this.severity,
    required this.userMessage,
  });

  final String code;
  final String severity;
  final String userMessage;

  static MessageSafetyHint? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final code = asNonEmptyString(json['code']);
    final userMessage = asNonEmptyString(json['userMessage']);
    if (code == null || userMessage == null) {
      return null;
    }
    return MessageSafetyHint(
      code: code,
      severity: asNonEmptyString(json['severity']) ?? 'LOW',
      userMessage: userMessage,
    );
  }
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.seq,
    required this.type,
    required this.mine,
    required this.deleted,
    required this.createdAt,
    this.body,
    this.systemCode,
    this.author,
    this.status,
    this.attachments = const [],
    this.safetyHints = const [],
  });

  final String id;
  final String conversationId;
  final int seq;
  final String type;
  final String? body;
  final String? systemCode;
  final ConversationPerson? author;
  final bool mine;
  final String? status;
  final List<MessageAttachment> attachments;
  final bool deleted;
  final DateTime createdAt;
  final List<MessageSafetyHint> safetyHints;

  bool get isSystem => type == 'SYSTEM';

  bool get isRead => status == 'READ';

  bool get isDelivered => status == 'DELIVERED' || isRead;

  bool get isSent => status == 'SENT' || isDelivered;

  ChatMessage copyWith({String? status}) {
    return ChatMessage(
      id: id,
      conversationId: conversationId,
      seq: seq,
      type: type,
      body: body,
      systemCode: systemCode,
      author: author,
      mine: mine,
      status: status ?? this.status,
      attachments: attachments,
      deleted: deleted,
      createdAt: createdAt,
      safetyHints: safetyHints,
    );
  }

  static ChatMessage? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final conversationId = asNonEmptyString(json['conversationId']);
    final seq = asInt(json['seq']);
    final createdAt = DateTime.tryParse(
      asNonEmptyString(json['createdAt']) ?? '',
    );
    if (id == null ||
        !PublicIds.isUuid(id) ||
        conversationId == null ||
        !PublicIds.isUuid(conversationId) ||
        seq == null ||
        createdAt == null) {
      return null;
    }
    final attachments = json['attachments'];
    final hints = json['safetyHints'];
    return ChatMessage(
      id: id,
      conversationId: conversationId,
      seq: seq,
      type: asNonEmptyString(json['type']) ?? 'TEXT',
      body: asNonEmptyString(json['body']),
      systemCode: asNonEmptyString(json['systemCode']),
      author: ConversationPerson.tryParse(json['author']),
      mine: json['mine'] == true,
      status: asNonEmptyString(json['status']),
      attachments: attachments is List
          ? [for (final item in attachments) ?MessageAttachment.tryParse(item)]
          : const [],
      deleted: json['deleted'] == true,
      createdAt: createdAt,
      safetyHints: hints is List
          ? [for (final item in hints) ?MessageSafetyHint.tryParse(item)]
          : const [],
    );
  }
}

class MessagesPage {
  const MessagesPage({
    required this.items,
    required this.hasMore,
    required this.lastReadSeq,
    required this.lastSeq,
  });

  final List<ChatMessage> items;
  final bool hasMore;
  final int lastReadSeq;
  final int lastSeq;

  static MessagesPage parse(Map<String, Object?> json) {
    final raw = json['items'];
    return MessagesPage(
      items: raw is List
          ? [for (final item in raw) ?ChatMessage.tryParse(item)]
          : const [],
      hasMore: json['hasMore'] == true,
      lastReadSeq: asInt(json['lastReadSeq']) ?? 0,
      lastSeq: asInt(json['lastSeq']) ?? 0,
    );
  }
}

class SendMessageResult {
  const SendMessageResult({required this.message, required this.duplicate});

  final ChatMessage message;
  final bool duplicate;

  static SendMessageResult parse(Map<String, Object?> json) {
    final message = ChatMessage.tryParse(json['message']);
    if (message == null) {
      throw const FormatException('Réponse de message inattendue.');
    }
    return SendMessageResult(
      message: message,
      duplicate: json['duplicate'] == true,
    );
  }
}

class MarkReadResult {
  const MarkReadResult({required this.lastReadSeq, required this.unread});

  final int lastReadSeq;
  final int unread;

  static MarkReadResult parse(Map<String, Object?> json) {
    return MarkReadResult(
      lastReadSeq: asInt(json['lastReadSeq']) ?? 0,
      unread: asInt(json['unread']) ?? 0,
    );
  }
}

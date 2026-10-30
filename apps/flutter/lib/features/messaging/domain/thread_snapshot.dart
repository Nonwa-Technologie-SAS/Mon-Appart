import '../../../core/errors/app_failure.dart';
import 'chat_message.dart';
import 'conversation.dart';

class ThreadSnapshot {
  const ThreadSnapshot({
    required this.conversation,
    required this.messages,
    required this.hasMoreOlder,
    this.loadingOlder = false,
    this.sending = false,
    this.catchingUp = false,
    this.pendingClientMessageId,
    this.pendingBody,
    this.sendError,
    this.actionError,
  });

  final Conversation conversation;
  final List<ChatMessage> messages;
  final bool hasMoreOlder;
  final bool loadingOlder;
  final bool sending;
  final bool catchingUp;
  final String? pendingClientMessageId;
  final String? pendingBody;
  final AppFailure? sendError;
  final AppFailure? actionError;

  bool get canSend =>
      !conversation.isClosed && !sending && conversation.status == 'OPEN';

  ThreadSnapshot copyWith({
    Conversation? conversation,
    List<ChatMessage>? messages,
    bool? hasMoreOlder,
    bool? loadingOlder,
    bool? sending,
    bool? catchingUp,
    String? pendingClientMessageId,
    String? pendingBody,
    AppFailure? sendError,
    AppFailure? actionError,
    bool clearPending = false,
    bool clearSendError = false,
    bool clearActionError = false,
  }) {
    return ThreadSnapshot(
      conversation: conversation ?? this.conversation,
      messages: messages ?? this.messages,
      hasMoreOlder: hasMoreOlder ?? this.hasMoreOlder,
      loadingOlder: loadingOlder ?? this.loadingOlder,
      sending: sending ?? this.sending,
      catchingUp: catchingUp ?? this.catchingUp,
      pendingClientMessageId: clearPending
          ? null
          : (pendingClientMessageId ?? this.pendingClientMessageId),
      pendingBody: clearPending ? null : (pendingBody ?? this.pendingBody),
      sendError: clearSendError ? null : (sendError ?? this.sendError),
      actionError: clearActionError ? null : (actionError ?? this.actionError),
    );
  }
}

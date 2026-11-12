import '../domain/chat_message.dart';

sealed class MessagingRealtimeEvent {
  const MessagingRealtimeEvent();
}

class RealtimeMessageHint extends MessagingRealtimeEvent {
  const RealtimeMessageHint({required this.conversationId, this.message});

  final String conversationId;
  final ChatMessage? message;
}

class RealtimeConversationHint extends MessagingRealtimeEvent {
  const RealtimeConversationHint({required this.conversationId});

  final String conversationId;
}

class RealtimeUnreadHint extends MessagingRealtimeEvent {
  const RealtimeUnreadHint({this.unread});

  final int? unread;
}

class RealtimeAppointmentHint extends MessagingRealtimeEvent {
  const RealtimeAppointmentHint({required this.appointmentId});

  final String appointmentId;
}

/// Canal d'événements Socket.IO. La source de vérité reste l'API REST.
abstract class MessagingRealtime {
  Stream<MessagingRealtimeEvent> get events;

  Future<void> connect();

  void disconnect();

  void dispose();
}

class NullMessagingRealtime implements MessagingRealtime {
  const NullMessagingRealtime();

  @override
  Stream<MessagingRealtimeEvent> get events => const Stream.empty();

  @override
  Future<void> connect() async {}

  @override
  void disconnect() {}

  @override
  void dispose() {}
}

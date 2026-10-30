import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/auth/session_store.dart';
import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';
import '../../../core/logging/app_logger.dart';
import '../domain/chat_message.dart';
import 'messaging_realtime.dart';

/// Client Socket.IO namespace `/realtime`. Les événements ne donnent aucun droit :
/// le fil se rattrape ensuite par `GET .../messages?after=`.
class SocketIoMessagingRealtime implements MessagingRealtime {
  SocketIoMessagingRealtime({
    required this.origin,
    required this.sessionStore,
    this.logger,
  });

  final Uri origin;
  final SessionStore sessionStore;
  final AppLogger? logger;

  final _controller = StreamController<MessagingRealtimeEvent>.broadcast();
  final _seenEventIds = <String>[];
  io.Socket? _socket;
  var _disposed = false;

  @override
  Stream<MessagingRealtimeEvent> get events => _controller.stream;

  @override
  Future<void> connect() async {
    if (_disposed) {
      return;
    }
    disconnect();
    final token = await sessionStore.readAccessToken();
    if (token == null || token.isEmpty || _disposed) {
      return;
    }
    final url = '${origin.origin}/realtime';
    try {
      final socket = io.io(
        url,
        io.OptionBuilder()
            .setTransports(['websocket'])
            .setAuth({'token': token})
            .enableReconnection()
            .enableForceNew()
            .disableAutoConnect()
            .build(),
      );
      _socket = socket;
      socket.on('message:new', _onMessageNew);
      socket.on('conversation:updated', _onConversationUpdated);
      socket.on('conversation:unread_count', _onUnread);
      socket.on('appointment:updated', _onAppointmentUpdated);
      socket.on('session:expired', (_) {
        logger?.debug('realtime session expired');
        disconnect();
      });
      socket.onConnectError((_) {
        logger?.debug('realtime connect error');
      });
      socket.connect();
    } catch (_) {
      logger?.debug('realtime unavailable');
    }
  }

  @override
  void disconnect() {
    final socket = _socket;
    _socket = null;
    if (socket == null) {
      return;
    }
    try {
      socket.dispose();
    } catch (_) {}
  }

  @override
  void dispose() {
    _disposed = true;
    disconnect();
    if (!_controller.isClosed) {
      unawaited(_controller.close());
    }
  }

  void _onMessageNew(dynamic data) {
    final json = _payload(data);
    if (json == null) {
      return;
    }
    final conversationId = asNonEmptyString(json['conversationId']);
    if (conversationId == null || !PublicIds.isUuid(conversationId)) {
      return;
    }
    _controller.add(
      RealtimeMessageHint(
        conversationId: conversationId,
        message: ChatMessage.tryParse(json['message']),
      ),
    );
  }

  void _onConversationUpdated(dynamic data) {
    final json = _payload(data);
    if (json == null) {
      return;
    }
    final conversationId = asNonEmptyString(json['conversationId']);
    if (conversationId == null || !PublicIds.isUuid(conversationId)) {
      return;
    }
    _controller.add(RealtimeConversationHint(conversationId: conversationId));
  }

  void _onUnread(dynamic data) {
    final json = _payload(data);
    if (json == null) {
      return;
    }
    _controller.add(RealtimeUnreadHint(unread: asInt(json['unread'])));
  }

  void _onAppointmentUpdated(dynamic data) {
    final json = _payload(data);
    if (json == null) {
      return;
    }
    final appointment = asJsonMapOrNull(json['appointment']);
    final appointmentId =
        asNonEmptyString(appointment?['id']) ?? asNonEmptyString(json['id']);
    if (appointmentId == null || !PublicIds.isUuid(appointmentId)) {
      return;
    }
    _controller.add(RealtimeAppointmentHint(appointmentId: appointmentId));
  }

  Map<String, Object?>? _payload(dynamic data) {
    final json = asJsonMapOrNull(data);
    if (json == null) {
      return null;
    }
    final eventId = asNonEmptyString(json['eventId']);
    if (eventId != null) {
      if (_seenEventIds.contains(eventId)) {
        return null;
      }
      _seenEventIds.add(eventId);
      if (_seenEventIds.length > 64) {
        _seenEventIds.removeRange(0, _seenEventIds.length - 64);
      }
    }
    return json;
  }
}

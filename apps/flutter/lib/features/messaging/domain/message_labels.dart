import 'chat_message.dart';

abstract final class MessageLabels {
  static String system(String? code) {
    return switch (code) {
      'APPOINTMENT_REQUESTED' => 'Une demande de visite a été envoyée.',
      'APPOINTMENT_CONFIRMED' => 'La visite a été confirmée.',
      'APPOINTMENT_RESCHEDULE_PROPOSED' =>
        'Une nouvelle date de visite a été proposée.',
      'APPOINTMENT_CANCELLED' => 'La visite a été annulée.',
      'APPOINTMENT_COMPLETED' => 'La visite a été marquée comme effectuée.',
      'APPOINTMENT_NO_SHOW' => 'La visite a été marquée comme non honorée.',
      'CONVERSATION_CLOSED' => 'Cette conversation a été fermée.',
      _ => 'Mise à jour de la conversation.',
    };
  }

  static String preview(ChatMessage? message) {
    if (message == null) {
      return 'Aucun message pour le moment.';
    }
    if (message.deleted) {
      return 'Message retiré.';
    }
    if (message.isSystem) {
      return system(message.systemCode);
    }
    final body = message.body;
    if (body != null && body.isNotEmpty) {
      return body;
    }
    if (message.attachments.isNotEmpty) {
      return message.attachments.first.label;
    }
    return 'Message';
  }

  static String? deliveryStatus(ChatMessage message) {
    if (!message.mine || message.isSystem) {
      return null;
    }
    return switch (message.status) {
      'READ' => 'Lu',
      'DELIVERED' => 'Reçu',
      'SENT' => 'Envoyé',
      _ => null,
    };
  }

  static String reportReason(String code) {
    return switch (code) {
      'SUSPECTED_SCAM' => 'Arnaque suspectée',
      'INAPPROPRIATE_CONTENT' => 'Contenu inapproprié',
      'MISLEADING_INFORMATION' => 'Informations trompeuses',
      'OTHER' => 'Autre motif',
      _ => code,
    };
  }
}

abstract final class ConversationReportReasons {
  static const values = <String>[
    'SUSPECTED_SCAM',
    'INAPPROPRIATE_CONTENT',
    'MISLEADING_INFORMATION',
    'OTHER',
  ];
}

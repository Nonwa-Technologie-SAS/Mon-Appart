import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/messaging/domain/chat_message.dart';
import 'package:mon_appart/features/messaging/domain/conversation.dart';
import 'package:mon_appart/features/messaging/domain/message_labels.dart';

import '../../helpers/messaging_fixtures.dart';

void main() {
  test('parse une conversation Nest et identifie l\'interlocuteur', () {
    final conversation = Conversation.tryParse(conversationJson(unread: 2));
    expect(conversation, isNotNull);
    expect(conversation!.counterpartName, 'Awa K.');
    expect(conversation.unread, 2);
    expect(conversation.listing.typeLabel, 'À louer');
    expect(conversation.listing.statusLabel, isNull);
  });

  test('ignore un payload de conversation incomplet', () {
    expect(Conversation.tryParse({'id': 'pas-un-uuid'}), isNull);
    expect(ChatMessage.tryParse({'id': testMessageId}), isNull);
  });

  test('déduplique et trie les messages par seq', () {
    final first = ChatMessage.tryParse(chatMessageJson(seq: 2, body: 'B'))!;
    final second = ChatMessage.tryParse(
      chatMessageJson(
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        seq: 1,
        body: 'A',
      ),
    )!;
    final byId = <String, ChatMessage>{first.id: first, second.id: second};
    byId[first.id] = first;
    final values = byId.values.toList()..sort((a, b) => a.seq.compareTo(b.seq));
    expect(values.map((item) => item.body), ['A', 'B']);
  });

  test('traduit un message système sans inventer un statut de lecture', () {
    final message = ChatMessage.tryParse(
      chatMessageJson(
        type: 'SYSTEM',
        body: null,
        systemCode: 'APPOINTMENT_REQUESTED',
        mine: false,
        status: null,
        author: null,
      ),
    )!;
    expect(message.isSystem, isTrue);
    expect(
      MessageLabels.system(message.systemCode),
      'Une demande de visite a été envoyée.',
    );
    expect(MessageLabels.deliveryStatus(message), isNull);
  });

  test('affiche un statut de lecture uniquement s\'il vient du serveur', () {
    final sent = ChatMessage.tryParse(chatMessageJson())!;
    expect(MessageLabels.deliveryStatus(sent), 'Envoyé');
    final read = sent.copyWith(status: 'READ');
    expect(MessageLabels.deliveryStatus(read), 'Lu');
    expect(
      MessageLabels.preview(
        ChatMessage.tryParse(chatMessageJson(deleted: true)),
      ),
      'Message retiré.',
    );
  });

  test('parse la reprise d\'une conversation existante', () {
    final started = StartConversationResult.parse(
      startConversationJson(created: false),
    );
    expect(started.created, isFalse);
    expect(started.conversation.id, testConversationId);
    expect(started.message?.seq, 1);
  });
}

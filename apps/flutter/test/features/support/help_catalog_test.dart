import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/app_config.dart';
import 'package:mon_appart/features/support/domain/help_catalog.dart';
import 'package:mon_appart/features/support/domain/own_report.dart';
import 'package:mon_appart/features/support/domain/support_channels.dart';

void main() {
  test('la recherche d\'aide tolère les accents et une lettre finale', () {
    expect(
      HelpCatalog.search('favori').map((article) => article.id),
      contains('annonces-favoris'),
    );
    expect(
      HelpCatalog.search('sécurité').map((article) => article.id),
      contains('securite-arnaques'),
    );
    expect(
      HelpCatalog.search('favorisx').map((article) => article.id),
      contains('annonces-favoris'),
    );
    expect(HelpCatalog.search('zzzzqq'), isEmpty);
    expect(HelpCatalog.search(''), HelpCatalog.articles);
    expect(HelpCatalog.byId('absent'), isNull);
  });

  test(
    'aucun canal n\'est ouvert sans numéro, et le texte WhatsApp reste neutre',
    () {
      expect(AppConfig.parseSupportNumber('  ', name: 'SUPPORT_PHONE'), isNull);
      expect(
        () => AppConfig.parseSupportNumber('0102030405', name: 'SUPPORT_PHONE'),
        throwsFormatException,
      );
      const number = '+2250707070707';
      expect(
        AppConfig.parseSupportNumber(number, name: 'SUPPORT_WHATSAPP'),
        number,
      );
      final uri = SupportChannels.whatsappUri(number)!;
      expect(uri.host, 'wa.me');
      expect(uri.queryParameters['text'], isNot(contains('@')));
      expect(SupportChannels.isAllowed(uri), isTrue);
      expect(SupportChannels.phoneUri(null), isNull);
      expect(SupportChannels.whatsappUri(null), isNull);
      expect(
        SupportChannels.isAllowed(Uri.parse('https://example.test')),
        isFalse,
      );
    },
  );

  test('un signalement public n\'expose pas l\'issue interne', () {
    final report = OwnReport.tryParse({
      'id': '11111111-1111-4111-8111-111111111111',
      'targetType': 'LISTING',
      'targetId': '22222222-2222-4222-8222-222222222222',
      'reason': 'SUSPECTED_SCAM',
      'status': 'RESOLVED',
      'createdAt': '2026-11-05T10:00:00.000Z',
      'resolvedAt': '2026-11-05T12:00:00.000Z',
    });
    expect(report?.statusLabel, 'Examiné');
    expect(
      OwnReport.tryParse({
        'id': '11111111-1111-4111-8111-111111111111',
        'targetType': 'LISTING',
        'targetId': '22222222-2222-4222-8222-222222222222',
        'reason': 'SUSPECTED_SCAM',
        'status': 'CONFIRMED',
        'createdAt': '2026-11-05T10:00:00.000Z',
        'resolvedAt': null,
      }),
      isNull,
    );
  });
}

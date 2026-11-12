import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/features/support/data/support_launcher.dart';
import 'package:mon_appart/features/support/presentation/support_providers.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

class _RecordingLauncher implements SupportLauncher {
  Uri? last;

  @override
  Future<bool> open(Uri uri) async {
    last = uri;
    return true;
  }
}

Future<void> pumpFrames(WidgetTester tester, {int times = 8}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('le centre d\'aide ne propose pas de numéro absent', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: AppRoutes.help,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Centre d\'aide'), findsOneWidget);
    expect(find.text('Appeler le support'), findsNothing);
    expect(find.text('Écrire sur WhatsApp'), findsNothing);
    expect(find.textContaining('Aucun numéro'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'zzzzqq');
    await pumpFrames(tester);
    expect(find.text('Aucun article'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'favori');
    await pumpFrames(tester);
    await tester.tap(find.text('Favoris'));
    await pumpFrames(tester);
    expect(find.textContaining('n\'est pas une réservation'), findsOneWidget);
  });

  testWidgets(
    'WhatsApp n\'ouvre que le lien configuré, sans donnée personnelle',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final launcher = _RecordingLauncher();
      await tester.pumpWidget(
        pumpMonAppart(
          config: testConfig(supportWhatsapp: '+2250707070707'),
          apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
          initialLocation: AppRoutes.help,
          overrides: [supportLauncherProvider.overrideWithValue(launcher)],
        ),
      );
      await pumpFrames(tester);
      await tester.tap(find.text('Écrire sur WhatsApp'));
      await pumpFrames(tester);
      expect(launcher.last?.host, 'wa.me');
      expect(launcher.last?.queryParameters['text'], isNot(contains('@')));
      expect(find.text('Appeler le support'), findsNothing);
    },
  );

  testWidgets('mes signalements affichent le statut public', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: FakeApiClient(
          handler: (uri) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson(firstName: 'Awa', lastName: 'Koné');
            }
            if (uri.path.endsWith('/trust/reports')) {
              return {
                'items': [
                  {
                    'id': '11111111-1111-4111-8111-111111111111',
                    'targetType': 'LISTING',
                    'targetId': '22222222-2222-4222-8222-222222222222',
                    'reason': 'INCORRECT_PRICE',
                    'status': 'IN_REVIEW',
                    'createdAt': '2026-11-05T10:00:00.000Z',
                    'resolvedAt': null,
                  },
                ],
              };
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.myReports,
      ),
    );
    await pumpFrames(tester, times: 20);
    expect(find.text('Prix trompeur'), findsOneWidget);
    expect(find.textContaining('En examen'), findsOneWidget);
    expect(find.text('Confirmé'), findsNothing);
  });
}

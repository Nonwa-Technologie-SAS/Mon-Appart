import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 8}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('affiche le formulaire de connexion et masque le mot de passe', (
    tester,
  ) async {
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: '/login',
      ),
    );
    await pumpFrames(tester);

    expect(find.text('Connexion'), findsWidgets);
    expect(find.text('E-mail ou téléphone'), findsOneWidget);
    expect(find.text('Mot de passe oublié'), findsOneWidget);
    expect(find.text('Créer un compte'), findsOneWidget);

    await tester.enterText(find.byType(TextField).at(1), 'secret');
    expect(
      tester.widget<TextField>(find.byType(TextField).at(1)).obscureText,
      isTrue,
    );
    await tester.tap(find.byTooltip('Afficher le mot de passe'));
    await tester.pump();
    expect(
      tester.widget<TextField>(find.byType(TextField).at(1)).obscureText,
      isFalse,
    );
  });

  testWidgets('valide les champs de connexion sans appeler Nest', (
    tester,
  ) async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/login',
      ),
    );
    await pumpFrames(tester);
    await tester.tap(find.text('Se connecter'));
    await pumpFrames(tester);
    expect(
      find.text('Saisissez votre e-mail ou votre numéro de téléphone.'),
      findsOneWidget,
    );
    expect(client.uris.any((uri) => uri.path.endsWith('/auth/login')), isFalse);
  });

  testWidgets('affiche l\'erreur API de connexion', (tester) async {
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/login')) {
          throw const HttpFailure(
            statusCode: 401,
            code: 'INVALID_CREDENTIALS',
            message: 'Identifiants invalides.',
          );
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/login',
      ),
    );
    await pumpFrames(tester);
    await tester.enterText(find.byType(TextField).first, 'user@example.com');
    await tester.enterText(find.byType(TextField).at(1), 'phrase-solide-42');
    await tester.tap(find.text('Se connecter'));
    await pumpFrames(tester);
    expect(find.text('Identifiants invalides.'), findsOneWidget);
    expect(find.text('user@example.com'), findsOneWidget);
  });

  testWidgets('connexion réussie avec next revient à l\'annonce', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(800, 2000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/login')) {
          return issuedAuthJson(
            user: authUserJson(emailVerified: true, status: 'ACTIVE'),
          );
        }
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(emailVerified: true, status: 'ACTIVE');
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: AppRoutes.loginWithNext(
          '/listings/11111111-1111-1111-1111-111111111111',
        ),
      ),
    );
    await pumpFrames(tester);
    await tester.enterText(find.byType(TextField).first, 'user@example.com');
    await tester.enterText(find.byType(TextField).at(1), 'phrase-solide-42');
    await tester.tap(find.text('Se connecter'));
    await pumpFrames(tester, times: 24);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
  });

  testWidgets(
    'inscription affiche les champs Nest et refuse un mot de passe court',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
      await tester.pumpWidget(
        pumpMonAppart(
          config: testConfig(),
          apiClient: client,
          initialLocation: '/register',
        ),
      );
      await pumpFrames(tester);
      expect(find.text('Créer un compte'), findsWidgets);
      expect(find.text('Prénom (facultatif)'), findsOneWidget);
      expect(find.textContaining('aucun champ supplémentaire'), findsOneWidget);

      await tester.enterText(find.byType(TextField).at(2), 'user@example.com');
      await tester.enterText(find.byType(TextField).at(4), 'court');
      await tester.enterText(find.byType(TextField).at(5), 'court');
      await tester.ensureVisible(find.text('Créer le compte'));
      await tester.tap(find.text('Créer le compte'));
      await pumpFrames(tester);
      expect(find.textContaining('au moins 10 caractères'), findsOneWidget);
      expect(
        client.uris.any((uri) => uri.path.endsWith('/auth/register')),
        isFalse,
      );
    },
  );

  testWidgets('récupération de compte affiche le message générique', (
    tester,
  ) async {
    const generic =
        'Si un compte correspond, un lien de réinitialisation vient d\'être envoyé.';
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/forgot-password')) {
          return {'message': generic};
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/forgot-password',
      ),
    );
    await pumpFrames(tester);
    await tester.enterText(find.byType(TextField).first, 'inconnu@example.com');
    await tester.tap(find.text('Envoyer la demande'));
    await pumpFrames(tester);
    expect(find.text(generic), findsOneWidget);
  });

  testWidgets('compte déconnecté propose login et inscription', (tester) async {
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: '/account',
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Vous n\'êtes pas connecté'), findsOneWidget);
    await tester.tap(find.text('Se connecter'));
    await pumpFrames(tester);
    expect(find.text('Connexion'), findsWidgets);
  });

  testWidgets('déconnexion nettoie le profil affiché', (tester) async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/auth/logout')) {
          return const {};
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: '/account',
      ),
    );
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpFrames(tester);
    expect(find.text('Awa'), findsOneWidget);
    await tester.ensureVisible(find.text('Se déconnecter'));
    await tester.tap(find.text('Se déconnecter'));
    await pumpFrames(tester);
    expect(find.text('Vous n\'êtes pas connecté'), findsOneWidget);
    expect(await store.readAccessToken(), isNull);
  });

  testWidgets('favoris sans session proposent la connexion', (tester) async {
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: '/favorites',
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Aucun favori enregistré'), findsOneWidget);
    await tester.tap(find.text('Se connecter'));
    await pumpFrames(tester);
    expect(find.text('Connexion'), findsWidgets);
  });
}

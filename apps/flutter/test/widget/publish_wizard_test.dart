import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/features/publish/data/publish_image_picker.dart';
import 'package:mon_appart/features/publish/presentation/publish_providers.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/pro_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 16}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

Future<void> tapContinue(WidgetTester tester) async {
  await tester.tap(find.text('Continuer'));
  await pumpFrames(tester);
}

Future<void> chooseDropdown(
  WidgetTester tester, {
  required int index,
  required String value,
}) async {
  final dropdowns = find.byType(DropdownButtonFormField<String>);
  await tester.ensureVisible(dropdowns.at(index));
  await tester.tap(dropdowns.at(index));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.tap(find.text(value).last);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  testWidgets('un particulier ne peut pas ouvrir le formulaire', (
    tester,
  ) async {
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
              return authUserJson(status: 'ACTIVE', emailVerified: true);
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.publish,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Espace professionnel'), findsOneWidget);
    expect(find.text('Type d\'annonce'), findsNothing);
  });

  testWidgets('parcours : validation, conservation, photos, récap', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final jpeg = [0xFF, 0xD8, 0xFF, 0x01, 0x02];
    final client = FakeApiClient(
      methodAwareHandler: (uri, method) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(
            status: 'ACTIVE',
            emailVerified: true,
            roles: const ['OWNER'],
          );
        }
        if (method == 'POST' && uri.path.endsWith('/properties')) {
          return managedPropertyJson(missing: const []);
        }
        if (method == 'POST' && uri.path.endsWith('/listings')) {
          return managedListingJson();
        }
        if (method == 'PUT' && uri.path.endsWith('/amenities')) {
          return const {};
        }
        if (method == 'PATCH' && uri.path.contains('/properties/')) {
          return managedPropertyJson(missing: const []);
        }
        if (method == 'POST' && uri.path.endsWith('/media/upload-sessions')) {
          return {
            'sessionId': '55555555-5555-4555-8555-555555555555',
            'upload': {
              'url': 'http://storage.test/object',
              'method': 'PUT',
              'headers': {'Content-Type': 'image/jpeg'},
              'expiresAt': '2026-10-29T12:00:00.000Z',
            },
          };
        }
        if (method == 'POST' && uri.path.endsWith('/complete')) {
          return {
            'media': {
              'id': '44444444-4444-4444-4444-444444444444',
              'type': 'IMAGE',
              'sortOrder': 0,
              'url': 'https://cdn.example/photo.jpg',
              'isPrimary': true,
            },
          };
        }
        if (uri.path.contains('/media/order') || uri.path.contains('/media/')) {
          return listingMediaJson();
        }
        if (method == 'PUT' && uri.path.endsWith('/price')) {
          return managedListingJson();
        }
        if (method == 'PATCH' && uri.path.contains('/listings/')) {
          return managedListingJson();
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: client,
        initialLocation: AppRoutes.publish,
        overrides: [
          publishImagePickerProvider.overrideWithValue(
            FakePublishImagePicker(
              gallery: [
                PickedPublishFile(
                  localId: 'local-1',
                  bytes: jpeg,
                  size: jpeg.length,
                  filename: 'salon.jpg',
                ),
              ],
            ),
          ),
        ],
      ),
    );
    await pumpFrames(tester);
    expect(find.textContaining('Type d\'annonce'), findsWidgets);

    await tapContinue(tester);
    expect(find.text('Choisissez un type de bien.'), findsOneWidget);

    await tester.tap(find.text('Villa'));
    await pumpFrames(tester);
    await tapContinue(tester);
    expect(find.textContaining('Informations du bien'), findsWidgets);

    await tester.enterText(
      find.byType(TextFormField).first,
      'Villa test Riviera',
    );
    await pumpFrames(tester);
    await tapContinue(tester);
    expect(find.textContaining('Localisation'), findsWidgets);
    expect(find.text('Villa test Riviera'), findsNothing);

    await tester.tap(find.text('Précédent'));
    await pumpFrames(tester);
    expect(find.text('Villa test Riviera'), findsOneWidget);

    await tapContinue(tester);
    expect(find.textContaining('Localisation'), findsWidgets);
    await tapContinue(tester);
    expect(find.text('Choisissez une commune.'), findsOneWidget);

    await chooseDropdown(tester, index: 0, value: 'Cocody');
    await chooseDropdown(tester, index: 1, value: 'Riviera');
    await tapContinue(tester);
    expect(find.textContaining('Prix'), findsWidgets);

    await tester.enterText(find.byType(TextFormField).first, '250000');
    await pumpFrames(tester);
    await tapContinue(tester);
    expect(find.textContaining('Caractéristiques'), findsWidgets);
    await tapContinue(tester);
    expect(find.textContaining('Photos'), findsWidgets);
    expect(find.text('Aucune photo'), findsOneWidget);

    await tester.tap(find.text('Galerie'));
    await pumpFrames(tester, times: 40);
    expect(find.text('Photo principale'), findsOneWidget);
    expect(find.text('Confirmée par le serveur'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.delete_outline));
    await pumpFrames(tester);
    expect(find.text('Aucune photo'), findsOneWidget);

    await tester.tap(find.text('Galerie'));
    await pumpFrames(tester, times: 40);
    expect(find.text('Photo principale'), findsOneWidget);

    await tapContinue(tester);
    expect(find.textContaining('Description'), findsWidgets);
    await tapContinue(tester);
    expect(find.textContaining('Vérification'), findsWidgets);
    expect(find.text('Villa test Riviera'), findsOneWidget);
    expect(find.text('RIVIERA · COCODY'), findsOneWidget);
    expect(find.textContaining('1 confirmée'), findsOneWidget);
  });

  testWidgets(
    'reprend un brouillon DRAFT et affiche une demande de correction',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final store = InMemorySessionStore();
      await store.save(
        const SessionTokens(accessToken: 'a', refreshToken: 'r'),
      );
      final client = FakeApiClient(
        methodAwareHandler: (uri, method) async {
          if (uri.path.endsWith('/auth/me')) {
            return authUserJson(
              status: 'ACTIVE',
              emailVerified: true,
              roles: const ['OWNER'],
            );
          }
          if (uri.path.endsWith('/listings/$testManagedListingId') &&
              method == 'GET') {
            return managedListingJson(status: 'DRAFT');
          }
          if (uri.path.endsWith('/properties/$testManagedPropertyId')) {
            return managedPropertyJson();
          }
          if (uri.path.endsWith('/history')) {
            return {
              'prices': <Map<String, Object?>>[],
              'statuses': [
                {
                  'oldStatus': 'PENDING_REVIEW',
                  'newStatus': 'DRAFT',
                  'reason': 'Photos trop sombres',
                  'createdAt': '2026-10-28T10:00:00.000Z',
                },
              ],
            };
          }
          if (uri.path.endsWith('/media')) {
            return listingMediaJson();
          }
          return catalogHandler(uri);
        },
      );
      await tester.pumpWidget(
        pumpMonAppart(
          config: testConfig(),
          sessionStore: store,
          apiClient: client,
          initialLocation: AppRoutes.publishListing(testManagedListingId),
        ),
      );
      await pumpFrames(tester, times: 24);
      expect(find.textContaining('Type d\'annonce'), findsWidgets);
      expect(find.text('Enregistré'), findsOneWidget);
      expect(find.text('Demandes de correction'), findsOneWidget);
      expect(find.textContaining('Photos trop sombres'), findsOneWidget);
    },
  );
}

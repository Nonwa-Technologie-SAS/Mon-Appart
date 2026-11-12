import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/providers.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/features/publish/domain/publish_draft.dart';
import 'package:mon_appart/features/publish/domain/publish_rules.dart';
import 'package:mon_appart/features/publish/presentation/publish_providers.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/pro_fixtures.dart';
import '../../helpers/test_app.dart';

ProviderContainer containerWith(
  FakeApiClient client,
  InMemorySessionStore store,
) {
  final container = ProviderContainer(
    overrides: [
      appConfigProvider.overrideWithValue(testConfig()),
      sessionStoreProvider.overrideWithValue(store),
      apiClientProvider.overrideWithValue(client),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('bloque l\'étape 1 sans type de bien', () async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final container = containerWith(FakeApiClient(), store);
    container.listen(publishControllerProvider(''), (_, _) {});
    final notifier = container.read(publishControllerProvider('').notifier);
    await container.read(publishControllerProvider('').future);
    final ok = await notifier.continueNext();
    expect(ok, isFalse);
    expect(
      container.read(publishControllerProvider('')).requireValue.fieldErrors,
      containsPair('propertyType', 'Choisissez un type de bien.'),
    );
  });

  test(
    'conserve les champs en changeant d\'étape et enregistre le brouillon',
    () async {
      final store = InMemorySessionStore();
      await store.save(
        const SessionTokens(accessToken: 'a', refreshToken: 'r'),
      );
      final client = FakeApiClient(
        methodAwareHandler: (uri, method) async {
          if (method == 'POST' && uri.path.endsWith('/properties')) {
            return managedPropertyJson(title: 'Villa test Riviera');
          }
          if (method == 'POST' && uri.path.endsWith('/listings')) {
            return managedListingJson();
          }
          if (method == 'PUT' && uri.path.endsWith('/amenities')) {
            return const {};
          }
          throw Exception(uri.path);
        },
      );
      final container = containerWith(client, store);
      container.listen(publishControllerProvider(''), (_, _) {});
      final notifier = container.read(publishControllerProvider('').notifier);
      await container.read(publishControllerProvider('').future);
      notifier.updateDraft(
        (draft) => draft.copyWith(
          listingType: 'RENT',
          propertyType: 'VILLA',
          propertyCategory: 'RESIDENTIAL',
          title: 'Villa test Riviera',
          communeCode: 'COCODY',
          neighborhoodCode: 'RIVIERA',
        ),
      );
      expect(await notifier.continueNext(), isTrue);
      expect(
        container.read(publishControllerProvider('')).requireValue.step,
        PublishStep.basics,
      );
      expect(await notifier.continueNext(), isTrue);
      expect(
        container.read(publishControllerProvider('')).requireValue.draft.title,
        'Villa test Riviera',
      );
      await notifier.saveDraft(manual: true);
      final saved = container.read(publishControllerProvider('')).requireValue;
      expect(saved.draft.propertyId, testManagedPropertyId);
      expect(saved.draft.listingId, testManagedListingId);
      expect(saved.saveStatus, SaveDraftStatus.saved);
      expect(client.lastBody?['amenities'], isA<List<Object?>>());
    },
  );

  test('soumet via POST publish et affiche le statut serveur', () async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      methodAwareHandler: (uri, method) async {
        if (uri.path.contains('/properties/') &&
            !uri.path.contains('/amenities') &&
            method == 'PATCH') {
          return managedPropertyJson(status: 'ACTIVE', missing: const []);
        }
        if (method == 'POST' && uri.path.endsWith('/properties')) {
          return managedPropertyJson(missing: const []);
        }
        if (method == 'POST' && uri.path.endsWith('/listings')) {
          return managedListingJson();
        }
        if (method == 'PUT' && uri.path.endsWith('/price')) {
          return managedListingJson();
        }
        if (method == 'PATCH' && uri.path.contains('/listings/')) {
          return managedListingJson();
        }
        if (method == 'PUT' && uri.path.endsWith('/amenities')) {
          return const {};
        }
        if (method == 'POST' && uri.path.endsWith('/publish')) {
          return managedListingJson(status: 'PENDING_REVIEW');
        }
        throw Exception('$method ${uri.path}');
      },
    );
    final container = containerWith(client, store);
    container.listen(publishControllerProvider(''), (_, _) {});
    final notifier = container.read(publishControllerProvider('').notifier);
    await container.read(publishControllerProvider('').future);
    notifier.updateDraft(
      (draft) => draft.copyWith(
        listingType: 'RENT',
        propertyType: 'APARTMENT',
        propertyCategory: 'RESIDENTIAL',
        title: 'Appartement 2 chambres à Cocody',
        communeCode: 'COCODY',
        neighborhoodCode: 'RIVIERA',
        surface: 75,
        bedrooms: 2,
        bathrooms: 1,
        amount: 250000,
        period: 'MONTH',
        latitude: 5.359,
        longitude: -3.958,
      ),
    );
    await notifier.submit();
    final state = container.read(publishControllerProvider('')).requireValue;
    expect(state.submittedStatus, 'PENDING_REVIEW');
    expect(state.draft.listingStatus, 'PENDING_REVIEW');
    expect(client.methods, contains('POST'));
    expect(client.uris.any((uri) => uri.path.endsWith('/publish')), isTrue);
  });

  test('un terrain n\'exige pas chambres et salles de bains', () {
    const draft = PublishDraft(
      propertyType: 'LAND',
      propertyCategory: 'LAND',
      title: 'Terrain Bingerville',
      landSurface: 600,
      latitude: 5.35,
      longitude: -3.88,
    );
    expect(draft.completenessGaps, isEmpty);
    expect(draft.isLand, isTrue);
  });
}

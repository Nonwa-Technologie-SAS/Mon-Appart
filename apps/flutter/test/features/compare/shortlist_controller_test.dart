import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/providers.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/offline/key_value_store.dart';
import 'package:mon_appart/core/offline/memory_key_value_store.dart';
import 'package:mon_appart/core/offline/offline_providers.dart';
import 'package:mon_appart/features/compare/domain/shortlist_entry.dart';
import 'package:mon_appart/features/compare/presentation/shortlist_providers.dart';
import 'package:mon_appart/features/notifications/data/push_device_store.dart';
import 'package:mon_appart/features/notifications/presentation/push_providers.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/test_app.dart';

const _a = ShortlistEntry(
  listingId: '11111111-1111-1111-1111-111111111111',
  title: 'A',
  propertyId: '22222222-2222-2222-2222-222222222222',
);
const _b = ShortlistEntry(
  listingId: '33333333-3333-3333-3333-333333333333',
  title: 'B',
  propertyId: '44444444-4444-4444-4444-444444444444',
);
const _c = ShortlistEntry(
  listingId: '55555555-5555-5555-5555-555555555555',
  title: 'C',
  propertyId: '66666666-6666-6666-6666-666666666666',
);
const _d = ShortlistEntry(
  listingId: '77777777-7777-7777-7777-777777777777',
  title: 'D',
  propertyId: '88888888-8888-8888-8888-888888888888',
);
const _e = ShortlistEntry(
  listingId: '99999999-9999-9999-9999-999999999999',
  title: 'E',
  propertyId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
);

ProviderContainer containerOf({KeyValueStore? store}) {
  return ProviderContainer(
    overrides: [
      appConfigProvider.overrideWithValue(testConfig()),
      sessionStoreProvider.overrideWithValue(InMemorySessionStore()),
      apiClientProvider.overrideWithValue(FakeApiClient()),
      tokenRefresherProvider.overrideWithValue(null),
      pushDeviceStoreProvider.overrideWithValue(InMemoryPushDeviceStore()),
      keyValueStoreProvider.overrideWithValue(store ?? MemoryKeyValueStore()),
    ],
  );
}

void main() {
  test('refuse les doublons et les identifiants invalides', () {
    final container = containerOf();
    addTearDown(container.dispose);
    final controller = container.read(shortlistControllerProvider.notifier);

    expect(controller.add(_a), ShortlistChange.added);
    expect(controller.add(_a), ShortlistChange.duplicate);
    expect(container.read(shortlistControllerProvider), hasLength(1));
    expect(
      controller.add(
        const ShortlistEntry(
          listingId: 'not-a-uuid',
          title: 'X',
          propertyId: '22222222-2222-2222-2222-222222222222',
        ),
      ),
      ShortlistChange.invalid,
    );
  });

  test('plafonne la shortlist à 4 annonces', () {
    final container = containerOf();
    addTearDown(container.dispose);
    final controller = container.read(shortlistControllerProvider.notifier);
    expect(controller.add(_a), ShortlistChange.added);
    expect(controller.add(_b), ShortlistChange.added);
    expect(controller.add(_c), ShortlistChange.added);
    expect(controller.add(_d), ShortlistChange.added);
    expect(controller.add(_e), ShortlistChange.full);
    expect(container.read(shortlistControllerProvider), hasLength(4));
  });

  test('replaceWith déduplique et respecte le plafond', () {
    final container = containerOf();
    addTearDown(container.dispose);
    final controller = container.read(shortlistControllerProvider.notifier);
    controller.replaceWith([_a, _a, _b, _c, _d, _e]);
    final ids = [
      for (final entry in container.read(shortlistControllerProvider))
        entry.listingId,
    ];
    expect(ids, [_a.listingId, _b.listingId, _c.listingId, _d.listingId]);
  });

  test('toggle retire une annonce déjà sélectionnée', () {
    final container = containerOf();
    addTearDown(container.dispose);
    final controller = container.read(shortlistControllerProvider.notifier);
    controller.add(_a);
    expect(controller.toggle(_a), ShortlistChange.removed);
    expect(container.read(shortlistControllerProvider), isEmpty);
  });

  test(
    'persiste la shortlist et la relit après un nouveau container',
    () async {
      final store = MemoryKeyValueStore();
      final first = containerOf(store: store);
      addTearDown(first.dispose);
      first.read(shortlistControllerProvider.notifier).add(_a);
      await Future<void>.delayed(Duration.zero);

      final second = containerOf(store: store);
      addTearDown(second.dispose);
      second.read(shortlistControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);
      final restored = second.read(shortlistControllerProvider);
      expect(restored.map((e) => e.listingId), [_a.listingId]);
    },
  );
}

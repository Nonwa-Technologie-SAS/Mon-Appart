import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/offline/memory_key_value_store.dart';
import 'package:mon_appart/core/offline/offline_cache.dart';
import 'package:mon_appart/core/offline/offline_policy.dart';

void main() {
  test('conserve une fiche et évince au-delà du plafond', () async {
    var now = DateTime.utc(2026, 10, 1);
    final cache = OfflineCache(store: MemoryKeyValueStore(), clock: () => now);
    for (var i = 0; i < OfflinePolicy.maxListings + 2; i++) {
      now = now.add(const Duration(minutes: 1));
      await cache.putListing('listing-$i', {'title': 'Bien $i'});
    }
    expect(await cache.getListing('listing-0'), isNull);
    expect(
      await cache.getListing('listing-${OfflinePolicy.maxListings + 1}'),
      isNotNull,
    );
  });

  test('nettoyage utilisateur sans toucher aux fiches publiques', () async {
    final cache = OfflineCache(store: MemoryKeyValueStore());
    await cache.putListing('l1', {'title': 'Public'});
    await cache.putFavorites('u1', {
      'items': [
        {'listingId': 'l1', 'title': 'Fav'},
      ],
    });
    await cache.clearUser('u1');
    expect(await cache.getListing('l1'), isNotNull);
    expect(await cache.getFavorites('u1'), isNull);
  });

  test(
    'une donnée au-delà de 7 jours est retirée à la prochaine écriture',
    () async {
      var now = DateTime.utc(2026, 1, 1);
      final cache = OfflineCache(
        store: MemoryKeyValueStore(),
        clock: () => now,
      );
      await cache.putListing('old', {'title': 'Ancien'});
      now = now.add(const Duration(days: 8));
      await cache.putListing('new', {'title': 'Récent'});
      expect(await cache.getListing('old'), isNull);
      expect(await cache.getListing('new'), isNotNull);
    },
  );
}

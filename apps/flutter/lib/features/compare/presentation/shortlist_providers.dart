import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/listing/public_ids.dart';
import '../../../core/offline/offline_cache.dart';
import '../../../core/offline/offline_providers.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/shortlist_entry.dart';

class ShortlistController extends Notifier<List<ShortlistEntry>> {
  var _dirty = false;

  @override
  List<ShortlistEntry> build() {
    ref.listen(authControllerProvider, (previous, next) {
      final previousId = previous?.value?.user?.id;
      final nextId = next.value?.user?.id;
      if (previousId != nextId) {
        _dirty = false;
        unawaited(_hydrate());
      }
    });
    unawaited(_hydrate());
    return const [];
  }

  bool contains(String listingId) {
    return state.any((entry) => entry.listingId == listingId);
  }

  ShortlistChange add(ShortlistEntry entry) {
    if (!entry.isValid || !PublicIds.isUuid(entry.listingId)) {
      return ShortlistChange.invalid;
    }
    if (contains(entry.listingId)) {
      return ShortlistChange.duplicate;
    }
    if (state.length >= ShortlistLimits.maxItems) {
      return ShortlistChange.full;
    }
    _dirty = true;
    state = [...state, entry];
    unawaited(_persist());
    return ShortlistChange.added;
  }

  void remove(String listingId) {
    _dirty = true;
    state = [
      for (final entry in state)
        if (entry.listingId != listingId) entry,
    ];
    unawaited(_persist());
  }

  ShortlistChange toggle(ShortlistEntry entry) {
    if (contains(entry.listingId)) {
      remove(entry.listingId);
      return ShortlistChange.removed;
    }
    return add(entry);
  }

  void replaceWith(Iterable<ShortlistEntry> entries) {
    final next = <ShortlistEntry>[];
    final seen = <String>{};
    for (final entry in entries) {
      if (!entry.isValid || seen.contains(entry.listingId)) {
        continue;
      }
      if (next.length >= ShortlistLimits.maxItems) {
        break;
      }
      seen.add(entry.listingId);
      next.add(entry);
    }
    _dirty = true;
    state = next;
    unawaited(_persist());
  }

  void clear() {
    _dirty = true;
    state = const [];
    unawaited(_persist());
  }

  Future<void> _hydrate() async {
    if (_dirty) {
      return;
    }
    final userId = ref.read(authControllerProvider).value?.user?.id;
    final raw = await ref
        .read(offlineCacheProvider)
        .getShortlist(OfflineCache.scopeOf(userId));
    if (_dirty) {
      return;
    }
    state = [for (final item in raw) ?ShortlistEntry.tryParse(item)];
  }

  Future<void> _persist() {
    final userId = ref.read(authControllerProvider).value?.user?.id;
    return ref.read(offlineCacheProvider).putShortlist(
      OfflineCache.scopeOf(userId),
      [for (final entry in state) entry.toJson()],
    );
  }
}

final shortlistControllerProvider =
    NotifierProvider<ShortlistController, List<ShortlistEntry>>(
      ShortlistController.new,
    );

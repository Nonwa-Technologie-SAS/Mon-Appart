import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../account/domain/housing_preferences.dart';
import '../../account/presentation/account_providers.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../listing/data/listing_repository.dart';
import '../../listing/domain/listing_trust.dart';
import '../../listing/presentation/listing_providers.dart';
import '../domain/compare_models.dart';
import '../domain/compare_rules.dart';
import '../domain/shortlist_entry.dart';
import 'shortlist_providers.dart';

final comparePreferencesProvider = FutureProvider<HousingPreferences>((
  ref,
) async {
  final session = await ref.watch(authControllerProvider.future);
  if (!session.isAuthenticated) {
    return const HousingPreferences();
  }
  try {
    return await ref.read(housingPreferenceRepositoryProvider).get();
  } on AppFailure {
    return const HousingPreferences();
  }
});

final compareReportProvider = FutureProvider<CompareReport>((ref) async {
  final entries = ref.watch(shortlistControllerProvider);
  if (entries.isEmpty) {
    return const CompareReport(
      items: [],
      rows: [],
      insights: [],
      questions: [],
    );
  }
  final repo = ref.read(listingRepositoryProvider);
  final items = await Future.wait(
    entries.map((entry) => _loadItem(repo, entry)),
  );
  final preferences = await ref.watch(comparePreferencesProvider.future);
  return CompareRules.build(items: items, preferences: preferences);
});

Future<CompareItem> _loadItem(
  ListingRepository repo,
  ShortlistEntry entry,
) async {
  try {
    final listing = await repo.getById(entry.listingId);
    var trust = const ListingTrust();
    try {
      trust = await repo.badges(entry.listingId);
    } catch (_) {}
    return CompareItem.loaded(listing, trust);
  } on ListingUnavailableFailure {
    return CompareItem.unavailable(entry);
  } on InvalidListingIdFailure {
    return CompareItem.unavailable(entry);
  } on AppFailure catch (error) {
    return CompareItem.failed(entry, error.message);
  }
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/listing/public_ids.dart';
import '../../compare/domain/shortlist_entry.dart';
import '../../compare/presentation/shortlist_providers.dart';
import '../../listing/data/listing_repository.dart';
import '../../listing/presentation/listing_providers.dart';
import '../data/maps_launcher.dart';
import '../domain/visit.dart';
import '../domain/visit_tour.dart';
import '../domain/visit_tour_rules.dart';
import 'visits_providers.dart';

final mapsLauncherProvider = Provider<MapsLauncher>((ref) {
  return const UrlMapsLauncher();
});

class VisitTourSelection extends Notifier<Set<String>> {
  var didAutofill = false;

  @override
  Set<String> build() => {};

  void replace(Iterable<String> ids) {
    didAutofill = true;
    state = {
      for (final id in ids)
        if (PublicIds.isUuid(id)) id,
    };
  }

  void autofillConfirmed(Iterable<Visit> visits) {
    if (didAutofill || state.isNotEmpty) {
      return;
    }
    didAutofill = true;
    state = {
      for (final visit in visits)
        if (visit.status == 'CONFIRMED') visit.id,
    };
  }

  void toggle(String id) {
    if (!PublicIds.isUuid(id)) {
      return;
    }
    final next = {...state};
    if (!next.add(id)) {
      next.remove(id);
    }
    if (next.length > VisitTourRules.maxStops) {
      return;
    }
    state = next;
  }
}

final visitTourSelectionProvider =
    NotifierProvider<VisitTourSelection, Set<String>>(VisitTourSelection.new);

final visitTourIncludeShortlistProvider =
    NotifierProvider<VisitTourShortlistFlag, bool>(VisitTourShortlistFlag.new);

class VisitTourShortlistFlag extends Notifier<bool> {
  @override
  bool build() => false;

  void setValue(bool value) => state = value;
}

final visitTourPlanProvider = FutureProvider<VisitTourPlan>((ref) async {
  final selectedIds = ref.watch(visitTourSelectionProvider);
  final includeShortlist = ref.watch(visitTourIncludeShortlistProvider);
  final visits = ref.watch(visitsControllerProvider).value?.items ?? const [];
  final shortlist = includeShortlist
      ? ref.watch(shortlistControllerProvider)
      : const <ShortlistEntry>[];
  final chosenVisits = VisitTourRules.chronological([
    for (final visit in visits)
      if (selectedIds.contains(visit.id)) visit,
  ]);
  final repo = ref.read(listingRepositoryProvider);
  final stops = <TourStop>[];
  for (final visit in chosenVisits.take(VisitTourRules.maxStops)) {
    stops.add(await _stopFromVisit(repo, visit));
  }
  if (includeShortlist) {
    final remaining = VisitTourRules.maxStops - stops.length;
    final seen = {for (final stop in stops) stop.listingId};
    for (final entry in shortlist.take(remaining)) {
      if (seen.contains(entry.listingId)) {
        continue;
      }
      seen.add(entry.listingId);
      stops.add(await _stopFromShortlist(repo, entry));
    }
  }
  return VisitTourRules.build(stops);
});

Future<TourStop> _stopFromVisit(ListingRepository repo, Visit visit) {
  return _loadStop(
    repo: repo,
    key: visit.id,
    kind: TourStopKind.appointment,
    listingId: visit.listingId,
    title: visit.listingTitle,
    visit: visit,
  );
}

Future<TourStop> _stopFromShortlist(
  ListingRepository repo,
  ShortlistEntry entry,
) {
  return _loadStop(
    repo: repo,
    key: 'shortlist-${entry.listingId}',
    kind: TourStopKind.shortlist,
    listingId: entry.listingId,
    title: entry.title,
  );
}

Future<TourStop> _loadStop({
  required ListingRepository repo,
  required String key,
  required TourStopKind kind,
  required String listingId,
  required String title,
  Visit? visit,
}) async {
  try {
    final listing = await repo.getById(listingId);
    final load = listing.location.hasPublicMapPoint
        ? TourStopLoad.loaded
        : TourStopLoad.missingCoords;
    return TourStop(
      key: key,
      kind: kind,
      listingId: listingId,
      title: listing.title,
      load: load,
      visit: visit,
      listing: listing,
    );
  } on ListingUnavailableFailure {
    return TourStop(
      key: key,
      kind: kind,
      listingId: listingId,
      title: title,
      load: TourStopLoad.unavailable,
      visit: visit,
    );
  } on InvalidListingIdFailure {
    return TourStop(
      key: key,
      kind: kind,
      listingId: listingId,
      title: title,
      load: TourStopLoad.unavailable,
      visit: visit,
    );
  } on AppFailure catch (error) {
    return TourStop(
      key: key,
      kind: kind,
      listingId: listingId,
      title: title,
      load: TourStopLoad.failed,
      visit: visit,
      errorMessage: error.message,
    );
  }
}

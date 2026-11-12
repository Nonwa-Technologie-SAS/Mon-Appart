import '../../../core/search/geo_search.dart';
import 'visit.dart';
import 'visit_tour.dart';

/// Planification déterministe. Aucun temps de trajet routier n'est inventé.
abstract final class VisitTourRules {
  static const maxStops = 8;
  static const tourableStatuses = <String>{
    'PENDING',
    'CONFIRMED',
    'RESCHEDULE_REQUESTED',
  };

  static bool canInclude(Visit visit) =>
      tourableStatuses.contains(visit.status);

  static List<Visit> chronological(Iterable<Visit> visits) {
    final next = [
      for (final visit in visits)
        if (canInclude(visit)) visit,
    ];
    next.sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
    return next;
  }

  static VisitTourPlan build(List<TourStop> stops) {
    final ordered = [...stops];
    ordered.sort(_compareStops);
    final notes = <String>[];
    final mapped = [
      for (final stop in ordered)
        if (stop.hasMapPoint) stop,
    ];
    if (ordered.any((stop) => stop.load == TourStopLoad.unavailable)) {
      notes.add(
        'Certaines annonces ne sont plus disponibles : elles restent dans la liste sans marqueur.',
      );
    }
    if (ordered.any(
      (stop) => !stop.hasMapPoint || stop.load == TourStopLoad.missingCoords,
    )) {
      notes.add(
        'Des biens n\'ont pas de coordonnées publiques : aucun marqueur ni lien de navigation n\'est créé pour eux.',
      );
    }
    if (ordered.any((stop) => stop.isApproximate)) {
      notes.add(
        'Les positions approximatives situent le quartier, pas la porte du logement.',
      );
    }
    if (ordered.any((stop) => stop.isPending)) {
      notes.add(
        'Les demandes en attente ne sont pas des rendez-vous confirmés. '
        'Leurs horaires peuvent encore changer.',
      );
    }
    notes.add(
      'Aucune API d\'itinéraire routier n\'est disponible. '
      'Les distances affichées sont à vol d\'oiseau, pas un temps de trajet à Abidjan.',
    );
    if (mapped.length >= 2) {
      final scheduled = [
        for (final stop in ordered)
          if (stop.scheduledAt != null) stop,
      ];
      if (scheduled.length >= 2) {
        final geoKeys = [for (final stop in _nearestNeighbor(mapped)) stop.key];
        final timeKeys = [
          for (final stop in scheduled)
            if (stop.hasMapPoint) stop.key,
        ];
        if (geoKeys.length >= 2 &&
            timeKeys.length >= 2 &&
            !_sameOrder(geoKeys, timeKeys)) {
          notes.add(
            'Un ordre géographique à vol d\'oiseau différerait, mais les horaires des visites sont conservés.',
          );
        }
      }
    }
    return VisitTourPlan(
      stops: ordered,
      conflicts: _conflicts(ordered),
      legs: _legs(ordered),
      notes: notes,
      gaps: _gaps(ordered),
    );
  }

  /// Plus proche voisin à vol d'oiseau — uniquement pour des étapes sans horaire.
  static List<TourStop> geographicHint(List<TourStop> stops) {
    final mapped = [
      for (final stop in stops)
        if (stop.hasMapPoint) stop,
    ];
    if (mapped.any((stop) => stop.scheduledAt != null)) {
      return chronologicalStops(stops);
    }
    return [..._nearestNeighbor(mapped), ...stops.where((s) => !s.hasMapPoint)];
  }

  static List<TourStop> chronologicalStops(List<TourStop> stops) {
    final next = [...stops];
    next.sort(_compareStops);
    return next;
  }

  static int _compareStops(TourStop a, TourStop b) {
    final aTime = a.scheduledAt;
    final bTime = b.scheduledAt;
    if (aTime != null && bTime != null) {
      return aTime.compareTo(bTime);
    }
    if (aTime != null) {
      return -1;
    }
    if (bTime != null) {
      return 1;
    }
    return a.title.compareTo(b.title);
  }

  static List<ScheduleConflict> _conflicts(List<TourStop> stops) {
    final timed = [
      for (final stop in stops)
        if (stop.scheduledAt != null && stop.endsAt != null) stop,
    ];
    final conflicts = <ScheduleConflict>[];
    for (var i = 0; i < timed.length; i++) {
      for (var j = i + 1; j < timed.length; j++) {
        final a = timed[i];
        final b = timed[j];
        if (_overlaps(a, b)) {
          conflicts.add(
            ScheduleConflict(
              first: a,
              second: b,
              text:
                  '« ${a.title} » et « ${b.title} » se chevauchent '
                  '(${a.durationMinutes} min et ${b.durationMinutes} min).',
            ),
          );
        }
      }
    }
    return conflicts;
  }

  static bool _overlaps(TourStop a, TourStop b) {
    final aStart = a.scheduledAt!;
    final bStart = b.scheduledAt!;
    final aEnd = a.endsAt!;
    final bEnd = b.endsAt!;
    return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
  }

  static List<String> _gaps(List<TourStop> stops) {
    final timed = [
      for (final stop in stops)
        if (stop.scheduledAt != null && stop.endsAt != null) stop,
    ]..sort((a, b) => a.scheduledAt!.compareTo(b.scheduledAt!));
    final gaps = <String>[];
    for (var i = 0; i < timed.length - 1; i++) {
      final current = timed[i];
      final next = timed[i + 1];
      if (_overlaps(current, next)) {
        continue;
      }
      final minutes = next.scheduledAt!.difference(current.endsAt!).inMinutes;
      if (minutes >= 0) {
        gaps.add(
          'Marge de $minutes min entre « ${current.title} » et « ${next.title} ». '
          'Le temps de trajet routier n\'est pas connu.',
        );
      }
    }
    return gaps;
  }

  static List<TourLeg> _legs(List<TourStop> stops) {
    final mapped = [
      for (final stop in stops)
        if (stop.hasMapPoint) stop,
    ];
    final legs = <TourLeg>[];
    for (var i = 0; i < mapped.length - 1; i++) {
      final from = mapped[i];
      final to = mapped[i + 1];
      final km = GeoSearch.haversineKm(
        from.listing!.location.latitude!,
        from.listing!.location.longitude!,
        to.listing!.location.latitude!,
        to.listing!.location.longitude!,
      );
      legs.add(TourLeg(from: from, to: to, distanceKm: km));
    }
    return legs;
  }

  static List<TourStop> _nearestNeighbor(List<TourStop> mapped) {
    if (mapped.length <= 1) {
      return mapped;
    }
    final remaining = [...mapped];
    final ordered = <TourStop>[remaining.removeAt(0)];
    while (remaining.isNotEmpty) {
      final last = ordered.last;
      var bestIndex = 0;
      var bestKm = double.infinity;
      for (var i = 0; i < remaining.length; i++) {
        final candidate = remaining[i];
        final km = GeoSearch.haversineKm(
          last.listing!.location.latitude!,
          last.listing!.location.longitude!,
          candidate.listing!.location.latitude!,
          candidate.listing!.location.longitude!,
        );
        if (km < bestKm) {
          bestKm = km;
          bestIndex = i;
        }
      }
      ordered.add(remaining.removeAt(bestIndex));
    }
    return ordered;
  }

  static bool _sameOrder(List<String> a, List<String> b) {
    if (a.length != b.length) {
      return false;
    }
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) {
        return false;
      }
    }
    return true;
  }
}

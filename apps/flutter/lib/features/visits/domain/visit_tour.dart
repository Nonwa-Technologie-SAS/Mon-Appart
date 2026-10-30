import '../../listing/domain/listing_detail.dart';
import 'visit.dart';

enum TourStopKind { appointment, shortlist }

enum TourStopLoad { loaded, unavailable, failed, missingCoords }

class TourStop {
  const TourStop({
    required this.key,
    required this.kind,
    required this.listingId,
    required this.title,
    required this.load,
    this.visit,
    this.listing,
    this.errorMessage,
  });

  final String key;
  final TourStopKind kind;
  final String listingId;
  final String title;
  final TourStopLoad load;
  final Visit? visit;
  final ListingDetail? listing;
  final String? errorMessage;

  bool get hasAppointment => visit != null;

  bool get isConfirmed => visit?.status == 'CONFIRMED';

  bool get isPending =>
      visit?.status == 'PENDING' || visit?.status == 'RESCHEDULE_REQUESTED';

  bool get hasMapPoint => listing?.location.hasPublicMapPoint == true;

  bool get isApproximate => listing?.location.isApproximate == true;

  DateTime? get scheduledAt => visit?.scheduledAt;

  int get durationMinutes => visit?.durationMinutes ?? 0;

  DateTime? get endsAt {
    final start = scheduledAt;
    if (start == null) {
      return null;
    }
    return start.add(Duration(minutes: durationMinutes));
  }
}

class ScheduleConflict {
  const ScheduleConflict({
    required this.first,
    required this.second,
    required this.text,
  });

  final TourStop first;
  final TourStop second;
  final String text;
}

class TourLeg {
  const TourLeg({
    required this.from,
    required this.to,
    required this.distanceKm,
  });

  final TourStop from;
  final TourStop to;
  final double distanceKm;
}

class VisitTourPlan {
  const VisitTourPlan({
    required this.stops,
    required this.conflicts,
    required this.legs,
    required this.notes,
    this.gaps = const [],
  });

  final List<TourStop> stops;
  final List<ScheduleConflict> conflicts;
  final List<TourLeg> legs;
  final List<String> notes;
  final List<String> gaps;

  List<TourStop> get mapped => [
    for (final stop in stops)
      if (stop.hasMapPoint) stop,
  ];
}

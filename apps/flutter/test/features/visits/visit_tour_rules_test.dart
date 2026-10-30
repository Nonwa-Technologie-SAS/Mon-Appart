import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/listing/domain/listing_detail.dart';
import 'package:mon_appart/features/visits/domain/visit.dart';
import 'package:mon_appart/features/visits/domain/visit_tour.dart';
import 'package:mon_appart/features/visits/domain/visit_tour_rules.dart';

import '../../helpers/listing_fixtures.dart';
import '../../helpers/visit_fixtures.dart';

TourStop _stop({
  required Map<String, Object?> appointment,
  Map<String, Object?>? listing,
}) {
  final visit = Visit.parse(appointment);
  final detail = ListingDetail.fromJson(listing ?? listingDetailJson());
  return TourStop(
    key: visit.id,
    kind: TourStopKind.appointment,
    listingId: visit.listingId,
    title: visit.listingTitle,
    load: detail.location.hasPublicMapPoint
        ? TourStopLoad.loaded
        : TourStopLoad.missingCoords,
    visit: visit,
    listing: detail,
  );
}

void main() {
  test('ordonne les visites selon l\'horaire Nest, pas un trajet inventé', () {
    final later = _stop(
      appointment: appointmentJson(
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        status: 'CONFIRMED',
        scheduledAt: '2026-11-02T12:00:00.000Z',
        listingTitle: 'Villa Marcory',
      ),
    );
    final earlier = _stop(
      appointment: appointmentJson(
        status: 'CONFIRMED',
        scheduledAt: '2026-11-02T09:00:00.000Z',
      ),
    );
    final plan = VisitTourRules.build([later, earlier]);
    expect(plan.stops.first.title, 'Appartement 2 chambres à Cocody');
    expect(plan.stops.last.title, 'Villa Marcory');
  });

  test('détecte un chevauchement d\'horaires', () {
    final first = _stop(
      appointment: appointmentJson(
        status: 'CONFIRMED',
        scheduledAt: '2026-11-02T10:00:00.000Z',
      ),
    );
    final second = _stop(
      appointment: appointmentJson(
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        status: 'CONFIRMED',
        scheduledAt: '2026-11-02T10:30:00.000Z',
        listingTitle: 'Studio Marcory',
      ),
    );
    final plan = VisitTourRules.build([first, second]);
    expect(plan.conflicts, isNotEmpty);
    expect(plan.conflicts.single.text, contains('se chevauchent'));
  });

  test('une marge horaire n\'invente pas un temps de trajet', () {
    final first = _stop(
      appointment: appointmentJson(
        status: 'CONFIRMED',
        scheduledAt: '2026-11-02T10:00:00.000Z',
      ),
    );
    final second = _stop(
      appointment: appointmentJson(
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        status: 'CONFIRMED',
        scheduledAt: '2026-11-02T12:00:00.000Z',
        listingTitle: 'Studio Marcory',
      ),
    );
    final plan = VisitTourRules.build([first, second]);
    expect(plan.conflicts, isEmpty);
    expect(plan.gaps.single, contains('Marge de 60 min'));
    expect(plan.gaps.single, contains('n\'est pas connu'));
  });

  test(
    'distance à vol d\'oiseau seulement si les deux points sont publics',
    () {
      final mapped = _stop(
        appointment: appointmentJson(status: 'CONFIRMED'),
        listing: listingDetailJson(latitude: 5.36, longitude: -3.98),
      );
      final hidden = _stop(
        appointment: appointmentJson(
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          status: 'CONFIRMED',
          scheduledAt: '2026-11-02T12:00:00.000Z',
          listingTitle: 'Sans carte',
        ),
        listing: listingDetailJson(
          id: '33333333-3333-3333-3333-333333333333',
          title: 'Sans carte',
          precision: 'NONE',
          latitude: 5.30,
          longitude: -4.00,
        ),
      );
      final plan = VisitTourRules.build([mapped, hidden]);
      expect(plan.legs, isEmpty);
      expect(
        plan.notes.any((note) => note.contains('coordonnées publiques')),
        isTrue,
      );
    },
  );

  test('une demande PENDING n\'est pas traitée comme confirmée', () {
    final pending = _stop(appointment: appointmentJson(status: 'PENDING'));
    final plan = VisitTourRules.build([pending]);
    expect(
      plan.notes.any((note) => note.contains('pas des rendez-vous confirmés')),
      isTrue,
    );
  });

  test('ignore CANCELLED et COMPLETED dans la tournée', () {
    expect(
      VisitTourRules.canInclude(
        Visit.parse(appointmentJson(status: 'CANCELLED')),
      ),
      isFalse,
    );
    expect(
      VisitTourRules.canInclude(
        Visit.parse(appointmentJson(status: 'COMPLETED')),
      ),
      isFalse,
    );
    expect(
      VisitTourRules.canInclude(
        Visit.parse(appointmentJson(status: 'CONFIRMED')),
      ),
      isTrue,
    );
  });

  test('l\'ordre géographique ne remplace pas les horaires confirmés', () {
    final south = _stop(
      appointment: appointmentJson(
        status: 'CONFIRMED',
        scheduledAt: '2026-11-02T09:00:00.000Z',
        listingTitle: 'Sud',
      ),
      listing: listingDetailJson(
        title: 'Sud',
        latitude: 5.20,
        longitude: -4.00,
      ),
    );
    final north = _stop(
      appointment: appointmentJson(
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        status: 'CONFIRMED',
        scheduledAt: '2026-11-02T11:00:00.000Z',
        listingTitle: 'Nord',
      ),
      listing: listingDetailJson(
        id: '33333333-3333-3333-3333-333333333333',
        title: 'Nord',
        latitude: 5.45,
        longitude: -3.95,
      ),
    );
    final plan = VisitTourRules.build([north, south]);
    expect(plan.stops.first.title, 'Sud');
    expect(VisitTourRules.geographicHint([north, south]).first.title, 'Sud');
    expect(plan.notes.any((note) => note.contains('vol d\'oiseau')), isTrue);
  });
}

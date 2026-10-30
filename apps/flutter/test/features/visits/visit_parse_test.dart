import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/visits/domain/visit.dart';
import 'package:mon_appart/features/visits/domain/visit_labels.dart';
import 'package:mon_appart/features/visits/domain/visit_rules.dart';

import '../../helpers/visit_fixtures.dart';

void main() {
  test('parse une visite Nest sans inventer photo ni confirmation', () {
    final visit = Visit.parse(appointmentJson());
    expect(visit.id, testAppointmentId);
    expect(visit.status, 'PENDING');
    expect(visit.listingTitle, 'Appartement 2 chambres à Cocody');
    expect(visit.can('CONFIRM'), isFalse);
    expect(visit.can('CANCEL'), isTrue);
    expect(VisitLabels.status(visit.status), 'En attente de confirmation');
  });

  test('refuse une réponse sans identifiant ou créneau', () {
    expect(Visit.tryParse({'id': 'not-a-uuid'}), isNull);
    expect(Visit.parseItems({'items': <Object?>[]}), isEmpty);
  });

  test('aligne le préavis et l\'horizon sur Nest', () {
    final now = DateTime.utc(2026, 10, 29, 10);
    expect(
      VisitRules.scheduleError(now.add(const Duration(minutes: 30)), now: now),
      isNotNull,
    );
    expect(
      VisitRules.scheduleError(now.add(const Duration(hours: 2)), now: now),
      isNull,
    );
    expect(
      VisitRules.scheduleError(now.add(const Duration(days: 91)), now: now),
      isNotNull,
    );
  });
}

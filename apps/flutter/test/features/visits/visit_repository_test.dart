import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/visits/data/visit_repository.dart';
import 'package:mon_appart/features/visits/domain/visits_snapshot.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';
import '../../helpers/visit_fixtures.dart';

void main() {
  const listingId = testVisitListingId;

  Future<VisitRepository> repo(FakeApiClient client) async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    return VisitRepository(
      client: client,
      endpoints: ApiEndpoints(Uri.parse('http://10.0.2.2:4000')),
      sessionStore: store,
    );
  }

  test('n\'appelle pas Nest sans session', () async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    final visits = VisitRepository(
      client: client,
      endpoints: ApiEndpoints(Uri.parse('http://10.0.2.2:4000')),
      sessionStore: InMemorySessionStore(),
    );
    await expectLater(
      visits.list(scope: VisitListScope.upcoming),
      throwsA(isA<NeedsAuthFailure>()),
    );
    expect(client.calls, 0);
  });

  test('crée une demande PENDING et refuse un identifiant invalide', () async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    final visits = await repo(client);
    final result = await visits.request(
      listingId: listingId,
      scheduledAt: DateTime.utc(2026, 11, 2, 10),
      notes: 'Disponible le matin',
      now: DateTime.utc(2026, 10, 28),
    );
    expect(result.alreadyExisted, isFalse);
    expect(result.visit.status, 'PENDING');
    expect(client.methods, contains('POST'));
    expect(client.lastBody?['timezone'], 'Africa/Abidjan');
    await expectLater(
      visits.getById('not-a-uuid'),
      throwsA(isA<InvalidAppointmentIdFailure>()),
    );
  });

  test('liste les visites à venir et relit le détail', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/appointments') &&
            uri.queryParameters['scope'] == 'upcoming') {
          return appointmentListJson(items: [appointmentJson()]);
        }
        return catalogHandler(uri);
      },
    );
    final visits = await repo(client);
    final items = await visits.list(scope: VisitListScope.upcoming);
    expect(items, hasLength(1));
    expect(items.single.status, 'PENDING');
    final detail = await visits.getById(testAppointmentId);
    expect(detail.id, testAppointmentId);
  });

  test(
    'confirme, reporte et annule uniquement via les endpoints Nest',
    () async {
      var status = 'PENDING';
      final client = FakeApiClient(
        methodAwareHandler: (uri, method) async {
          if (uri.path.endsWith('/confirm')) {
            status = 'CONFIRMED';
            return appointmentJson(status: status, actions: const ['CANCEL']);
          }
          if (uri.path.endsWith('/reschedule')) {
            status = 'RESCHEDULE_REQUESTED';
            return appointmentJson(
              status: status,
              proposedAt: '2026-11-03T10:00:00.000Z',
              proposedBy: 'REQUESTER',
              actions: const ['CONFIRM', 'CANCEL'],
            );
          }
          if (uri.path.endsWith('/cancel')) {
            status = 'CANCELLED';
            return appointmentJson(status: status, actions: const []);
          }
          return catalogHandler(uri);
        },
      );
      final visits = await repo(client);
      expect((await visits.confirm(testAppointmentId)).status, 'CONFIRMED');
      expect(
        (await visits.reschedule(
          testAppointmentId,
          DateTime.now().toUtc().add(const Duration(days: 2)),
        )).status,
        'RESCHEDULE_REQUESTED',
      );
      expect(
        (await visits.cancel(testAppointmentId, 'SCHEDULE_CONFLICT')).status,
        'CANCELLED',
      );
      expect(client.lastBody?['reason'], 'SCHEDULE_CONFLICT');
    },
  );

  test('409 APPOINTMENT_ALREADY_ACTIVE expose la visite existante', () async {
    final client = FakeApiClient(
      methodAwareHandler: (uri, method) async {
        if (uri.path.endsWith('/appointments') && method == 'POST') {
          throw const HttpFailure(
            statusCode: 409,
            code: 'APPOINTMENT_ALREADY_ACTIVE',
            message: 'Une visite est déjà en cours.',
          );
        }
        if (uri.path.endsWith('/appointments')) {
          return appointmentListJson(items: [appointmentJson()]);
        }
        return catalogHandler(uri);
      },
    );
    final visits = await repo(client);
    await expectLater(
      visits.request(
        listingId: listingId,
        scheduledAt: DateTime.utc(2026, 11, 2, 10),
        now: DateTime.utc(2026, 10, 28),
      ),
      throwsA(
        isA<AppointmentAlreadyActiveFailure>().having(
          (error) => error.existingId,
          'existingId',
          testAppointmentId,
        ),
      ),
    );
  });

  test('404 devient AppointmentUnavailableFailure', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.contains('/appointments/')) {
          throw const HttpFailure(
            statusCode: 404,
            code: 'APPOINTMENT_NOT_FOUND',
            message: 'Introuvable',
          );
        }
        return catalogHandler(uri);
      },
    );
    final visits = await repo(client);
    await expectLater(
      visits.getById(testAppointmentId),
      throwsA(isA<AppointmentUnavailableFailure>()),
    );
  });
}

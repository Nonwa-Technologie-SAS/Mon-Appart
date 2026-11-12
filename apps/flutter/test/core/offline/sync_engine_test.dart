import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/offline/memory_key_value_store.dart';
import 'package:mon_appart/core/offline/pending_operation.dart';
import 'package:mon_appart/core/offline/pending_queue.dart';
import 'package:mon_appart/core/offline/sync_engine.dart';

void main() {
  late PendingQueue queue;
  late SyncEngine engine;
  var now = DateTime.utc(2026, 10, 30, 12);

  setUp(() {
    now = DateTime.utc(2026, 10, 30, 12);
    queue = PendingQueue(store: MemoryKeyValueStore(), clock: () => now);
    engine = SyncEngine(queue: queue, clock: () => now);
  });

  Future<void> enqueueAdd() {
    return queue.enqueue(
      PendingOperation.create(
        userId: 'u1',
        type: PendingOpType.favoriteAdd,
        entityId: 'listing-1',
        now: now,
        idFactory: () => 'op-1',
      ),
    );
  }

  test('synchronise une action hors ligne à la reconnexion', () async {
    await enqueueAdd();
    final added = <String>[];
    final report = await engine.drain(
      userId: 'u1',
      handlers: SyncHandlers(
        favoriteAdd: (id) async => added.add(id),
        favoriteRemove: (_) async {},
        preferencesPut: (_) async {},
      ),
    );
    expect(report.synced, 1);
    expect(added, ['listing-1']);
    expect(await queue.openFor('u1'), isEmpty);
  });

  test('n\'envoie pas l\'opération d\'un autre compte', () async {
    await enqueueAdd();
    final added = <String>[];
    await engine.drain(
      userId: 'other',
      handlers: SyncHandlers(
        favoriteAdd: (id) async => added.add(id),
        favoriteRemove: (_) async {},
        preferencesPut: (_) async {},
      ),
    );
    expect(added, isEmpty);
    expect(await queue.openFor('u1'), hasLength(1));
  });

  test('échec temporaire puis succès', () async {
    await enqueueAdd();
    var calls = 0;
    final first = await engine.drain(
      userId: 'u1',
      handlers: SyncHandlers(
        favoriteAdd: (_) async {
          calls += 1;
          throw const NetworkFailure();
        },
        favoriteRemove: (_) async {},
        preferencesPut: (_) async {},
      ),
    );
    expect(first.failedTemporary, 1);
    expect(await queue.openFor('u1'), hasLength(1));

    now = now.add(const Duration(minutes: 5));
    final second = await engine.drain(
      userId: 'u1',
      handlers: SyncHandlers(
        favoriteAdd: (_) async {
          calls += 1;
        },
        favoriteRemove: (_) async {},
        preferencesPut: (_) async {},
      ),
    );
    expect(second.synced, 1);
    expect(calls, 2);
  });

  test('échec définitif 400 reste identifiable', () async {
    await enqueueAdd();
    await engine.drain(
      userId: 'u1',
      handlers: SyncHandlers(
        favoriteAdd: (_) async {
          throw const HttpFailure(statusCode: 400, message: 'invalide');
        },
        favoriteRemove: (_) async {},
        preferencesPut: (_) async {},
      ),
    );
    final all = await queue.list(userId: 'u1');
    expect(all.single.status, PendingOpStatus.failedPermanent);
    expect(all.single.lastError, 'invalide');
  });

  test('401 arrête la file sans rejouer le jeton', () async {
    await queue.enqueue(
      PendingOperation.create(
        userId: 'u1',
        type: PendingOpType.favoriteAdd,
        entityId: 'a',
        now: now,
        idFactory: () => 'op-a',
      ),
    );
    await queue.enqueue(
      PendingOperation.create(
        userId: 'u1',
        type: PendingOpType.favoriteAdd,
        entityId: 'b',
        now: now,
        idFactory: () => 'op-b',
      ),
    );
    final report = await engine.drain(
      userId: 'u1',
      handlers: SyncHandlers(
        favoriteAdd: (_) async {
          throw const HttpFailure(statusCode: 401, message: 'expiré');
        },
        favoriteRemove: (_) async {},
        preferencesPut: (_) async {},
      ),
    );
    expect(report.stoppedForAuth, isTrue);
    expect(report.failedPermanent, 1);
    expect(report.skipped, 1);
  });

  test('après 5 échecs temporaires, l\'opération devient définitive', () async {
    await enqueueAdd();
    for (var i = 0; i < 5; i++) {
      now = now.add(const Duration(minutes: 5));
      await engine.drain(
        userId: 'u1',
        handlers: SyncHandlers(
          favoriteAdd: (_) async {
            throw const NetworkFailure();
          },
          favoriteRemove: (_) async {},
          preferencesPut: (_) async {},
        ),
      );
    }
    final remaining = await queue.list(userId: 'u1');
    expect(remaining.single.status, PendingOpStatus.failedPermanent);
    expect(remaining.single.attempts, 5);
  });
}

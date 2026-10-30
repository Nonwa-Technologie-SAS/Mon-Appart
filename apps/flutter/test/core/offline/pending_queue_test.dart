import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/offline/memory_key_value_store.dart';
import 'package:mon_appart/core/offline/pending_operation.dart';
import 'package:mon_appart/core/offline/pending_queue.dart';

void main() {
  late PendingQueue queue;
  final now = DateTime.utc(2026, 10, 30, 12);

  setUp(() {
    queue = PendingQueue(store: MemoryKeyValueStore(), clock: () => now);
  });

  PendingOperation op({
    required String userId,
    required PendingOpType type,
    required String entityId,
  }) {
    return PendingOperation.create(
      userId: userId,
      type: type,
      entityId: entityId,
      now: now,
      idFactory: () => 'op-$userId-$entityId-${type.name}',
    );
  }

  test('coalesce add puis remove sur le même bien', () async {
    await queue.enqueue(
      op(userId: 'u1', type: PendingOpType.favoriteAdd, entityId: 'l1'),
    );
    await queue.enqueue(
      op(userId: 'u1', type: PendingOpType.favoriteRemove, entityId: 'l1'),
    );
    final open = await queue.openFor('u1');
    expect(open, hasLength(2));
    expect(open.last.type, PendingOpType.favoriteRemove);
  });

  test('deux ajouts du même bien ne dupliquent pas', () async {
    await queue.enqueue(
      op(userId: 'u1', type: PendingOpType.favoriteAdd, entityId: 'l1'),
    );
    await queue.enqueue(
      op(userId: 'u1', type: PendingOpType.favoriteAdd, entityId: 'l1'),
    );
    expect(await queue.openFor('u1'), hasLength(1));
  });

  test('sépare les files par utilisateur', () async {
    await queue.enqueue(
      op(userId: 'u1', type: PendingOpType.favoriteAdd, entityId: 'l1'),
    );
    await queue.enqueue(
      op(userId: 'u2', type: PendingOpType.favoriteAdd, entityId: 'l1'),
    );
    expect(await queue.openFor('u1'), hasLength(1));
    expect(await queue.openFor('u2'), hasLength(1));
    await queue.clearUser('u1');
    expect(await queue.openFor('u1'), isEmpty);
    expect(await queue.openFor('u2'), hasLength(1));
  });

  test('survit à un rechargement du store', () async {
    final store = MemoryKeyValueStore();
    final first = PendingQueue(store: store, clock: () => now);
    await first.enqueue(
      op(userId: 'u1', type: PendingOpType.favoriteAdd, entityId: 'l1'),
    );
    final second = PendingQueue(store: store, clock: () => now);
    expect(await second.openFor('u1'), hasLength(1));
  });

  test('reprend une opération interrompue (statut running)', () async {
    final store = MemoryKeyValueStore();
    final first = PendingQueue(store: store, clock: () => now);
    await first.enqueue(
      op(userId: 'u1', type: PendingOpType.favoriteAdd, entityId: 'l1'),
    );
    final open = await first.openFor('u1');
    await first.replace(open.single.copyWith(status: PendingOpStatus.running));
    final second = PendingQueue(store: store, clock: () => now);
    final recovered = await second.openFor('u1');
    expect(recovered, hasLength(1));
    expect(recovered.single.status, PendingOpStatus.pending);
  });
}

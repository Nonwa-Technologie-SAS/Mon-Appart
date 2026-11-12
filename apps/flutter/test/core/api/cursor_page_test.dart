import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/api/cursor_page.dart';

void main() {
  test('désérialise items + nextCursor', () {
    final page = CursorPage.fromJson({
      'items': [
        {'id': 'a'},
        {'id': 'b'},
      ],
      'nextCursor': 'cursor-2',
    }, (item) => item['id']! as String);
    expect(page.items, ['a', 'b']);
    expect(page.nextCursor, 'cursor-2');
    expect(page.hasMore, isTrue);
  });

  test('nextCursor null → pas de page suivante', () {
    final page = CursorPage.fromJson({
      'items': <Object?>[],
      'nextCursor': null,
    }, (item) => item);
    expect(page.items, isEmpty);
    expect(page.hasMore, isFalse);
  });
}

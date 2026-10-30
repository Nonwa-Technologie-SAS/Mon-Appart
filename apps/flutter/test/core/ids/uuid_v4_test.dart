import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/ids/uuid_v4.dart';

void main() {
  test('génère un UUID version 4 déterministe', () {
    final value = UuidV4.generate(Random(1));
    expect(UuidV4.isV4(value), isTrue);
    expect(UuidV4.generate(Random(1)), value);
  });

  test('rejette un UUID d\'une autre version', () {
    expect(UuidV4.isV4('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), isFalse);
  });
}

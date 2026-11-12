import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/logging/sensitive_data.dart';

void main() {
  test('masque Authorization et les jetons JSON', () {
    final headers = redactHeaders({
      'Authorization': 'Bearer secret',
      'Accept': 'application/json',
    });
    expect(headers['Authorization'], '***');
    expect(headers['Accept'], 'application/json');

    final body = redactJson({
      'accessToken': 'aaa',
      'refreshToken': 'bbb',
      'identifier': 'a@b.c',
      'password': 'secret',
      'user': {'id': '1'},
    });
    expect(body, {
      'accessToken': '***',
      'refreshToken': '***',
      'identifier': '***',
      'password': '***',
      'user': {'id': '1'},
    });
  });
}

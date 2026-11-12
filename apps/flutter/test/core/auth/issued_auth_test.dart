import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/auth/auth_user.dart';
import 'package:mon_appart/core/auth/issued_auth.dart';

import '../../helpers/auth_fixtures.dart';

void main() {
  test('parse une AuthResponseDto Bearer complète', () {
    final issued = IssuedAuth.fromJson(issuedAuthJson());
    expect(issued.tokens.accessToken, 'access-token');
    expect(issued.tokens.refreshToken, 'refresh-token');
    expect(issued.sessionId, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(issued.user.email, 'user@example.com');
    expect(issued.user.needsVerification, isTrue);
  });

  test('refuse une réponse sans accessToken', () {
    expect(
      () => IssuedAuth.fromJson({'sessionId': 'x', 'user': authUserJson()}),
      throwsFormatException,
    );
  });

  test('un profil PENDING avec e-mail non vérifié reste identifiable', () {
    final user = AuthUser.fromJson(authUserJson());
    expect(user.isPending, isTrue);
    expect(user.needsEmailVerification, isTrue);
    expect(user.displayName, 'Awa');
  });
}

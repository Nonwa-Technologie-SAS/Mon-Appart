Map<String, Object?> authUserJson({
  String id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  String? email = 'user@example.com',
  String? phone,
  String status = 'PENDING',
  bool emailVerified = false,
  bool phoneVerified = false,
  String? firstName = 'Awa',
  String? lastName,
  List<String> roles = const ['CUSTOMER'],
}) {
  return {
    'id': id,
    'email': email,
    'phone': phone,
    'firstName': firstName,
    'lastName': lastName,
    'status': status,
    'emailVerified': emailVerified,
    'phoneVerified': phoneVerified,
    'roles': roles,
    'createdAt': '2026-10-20T10:00:00.000Z',
  };
}

Map<String, Object?> issuedAuthJson({
  String accessToken = 'access-token',
  String? refreshToken = 'refresh-token',
  String sessionId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  Map<String, Object?>? user,
}) {
  return {
    'tokenType': 'Bearer',
    'accessToken': accessToken,
    'accessTokenExpiresAt': '2026-10-20T10:15:00.000Z',
    'refreshToken': ?refreshToken,
    'refreshTokenExpiresAt': '2026-11-19T10:00:00.000Z',
    'sessionId': sessionId,
    'user': user ?? authUserJson(),
  };
}

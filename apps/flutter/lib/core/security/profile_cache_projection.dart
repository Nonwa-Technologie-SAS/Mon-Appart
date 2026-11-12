/// Projection disque du profil. L'objet en mémoire garde l'e-mail et le téléphone.
Map<String, Object?> profileForDisk(Map<String, Object?> json) {
  final copy = Map<String, Object?>.from(json);
  const dropped = <String>[
    'email',
    'phone',
    'password',
    'currentPassword',
    'newPassword',
    'accessToken',
    'refreshToken',
    'token',
    'code',
    'otp',
    'identifier',
  ];
  for (final key in dropped) {
    copy.remove(key);
  }
  return copy;
}

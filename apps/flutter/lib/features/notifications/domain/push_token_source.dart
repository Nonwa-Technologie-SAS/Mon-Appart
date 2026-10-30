/// Source du jeton push natif (FCM/APNs).
///
/// Aucun fournisseur n'est livré dans ce dépôt : [NullPushTokenSource]
/// retourne toujours `null`. Un jeton local n'est pas une preuve d'envoi.
abstract class PushTokenSource {
  Future<String?> currentToken();

  Stream<String> get onTokenRefresh;
}

class NullPushTokenSource implements PushTokenSource {
  const NullPushTokenSource();

  @override
  Future<String?> currentToken() async => null;

  @override
  Stream<String> get onTokenRefresh => const Stream.empty();
}

/// Compte les échecs de connexion de la session processus, sans identifiant.
class AuthFailureSignal {
  static const threshold = 5;

  var _count = 0;

  int get count => _count;

  void success() {
    _count = 0;
  }

  /// `true` lorsque le seuil d'échecs répétés est atteint.
  bool failure() {
    _count += 1;
    return _count >= threshold;
  }
}

/// Canaux externes réellement configurés. Jamais un numéro par défaut.
abstract final class SupportChannels {
  static const whatsappIntro =
      'Bonjour, je contacte le support Mon Appart depuis l\'application.';

  static Uri? phoneUri(String? e164) {
    if (e164 == null) {
      return null;
    }
    return Uri(scheme: 'tel', path: e164);
  }

  static Uri? whatsappUri(String? e164) {
    if (e164 == null || !e164.startsWith('+')) {
      return null;
    }
    return Uri.https('wa.me', '/${e164.substring(1)}', {'text': whatsappIntro});
  }

  /// `tel:` E.164 ou `https://wa.me/{chiffres}` seulement.
  static bool isAllowed(Uri uri) {
    if (uri.scheme == 'tel') {
      return RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(uri.path);
    }
    if (uri.scheme == 'https' && uri.host == 'wa.me') {
      final text = uri.queryParameters['text'] ?? '';
      return RegExp(r'^/[1-9]\d{7,14}$').hasMatch(uri.path) &&
          !text.contains('@') &&
          text == whatsappIntro;
    }
    return false;
  }
}

import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/auth/auth_rules.dart';

void main() {
  test('identifiant obligatoire', () {
    expect(AuthRules.identifierError(''), isNotNull);
    expect(AuthRules.identifierError('user@example.com'), isNull);
    expect(AuthRules.identifierError('+2250701020304'), isNull);
  });

  test('e-mail et téléphone facultatifs sauf contact', () {
    expect(AuthRules.emailError(''), isNull);
    expect(AuthRules.emailError('pas-un-email'), isNotNull);
    expect(AuthRules.phoneError('+2250701020304'), isNull);
    expect(AuthRules.contactError(email: '', phone: ''), isNotNull);
    expect(
      AuthRules.contactError(email: 'user@example.com', phone: ''),
      isNull,
    );
  });

  test('mot de passe aligné sur Nest (10 caractères, pas trop courant)', () {
    expect(AuthRules.passwordError('court'), isNotNull);
    expect(AuthRules.passwordError('password123'), isNotNull);
    expect(AuthRules.passwordError('aaaaaaaaaa'), isNotNull);
    expect(
      AuthRules.passwordError('secret-solide-42', email: 'secret@x.ci'),
      isNotNull,
    );
    expect(AuthRules.passwordError('phrase-solide-42'), isNull);
    expect(
      AuthRules.confirmPasswordError('phrase-solide-42', 'autre'),
      isNotNull,
    );
  });

  test('OTP et jeton de réinitialisation', () {
    expect(AuthRules.otpError('12'), isNotNull);
    expect(AuthRules.otpError('123456'), isNull);
    expect(AuthRules.resetTokenError('trop-court'), isNotNull);
    expect(AuthRules.resetTokenError('a' * 32), isNull);
  });
}

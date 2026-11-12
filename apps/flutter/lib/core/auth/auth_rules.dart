/// Validations locales alignées sur Identity Nest. Le serveur reste l'autorité.
abstract final class AuthRules {
  static const passwordMinLength = 10;
  static const passwordMaxLength = 128;
  static const emailMaxLength = 254;
  static const nameMaxLength = 100;

  static final emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  static const _commonPasswords = <String>{
    '1234567890',
    '12345678910',
    '0123456789',
    'azertyuiop',
    'qwertyuiop',
    'motdepasse',
    'motdepasse1',
    'motdepasse123',
    'password123',
    'password1234',
    'iloveyou123',
    'abidjan2024',
    'abidjan2025',
    'abidjan2026',
    'monappart123',
    '0000000000',
    '1111111111',
  };

  static String? nameError(String raw) {
    if (raw.trim().length > nameMaxLength) {
      return 'Le nom ne doit pas dépasser $nameMaxLength caractères.';
    }
    return null;
  }

  static String? identifierError(String raw) {
    if (raw.trim().isEmpty) {
      return 'Saisissez votre e-mail ou votre numéro de téléphone.';
    }
    if (raw.trim().length > emailMaxLength) {
      return 'Identifiant trop long.';
    }
    return null;
  }

  static String? emailError(String raw, {bool required = false}) {
    final email = raw.trim();
    if (email.isEmpty) {
      return required ? 'Saisissez une adresse e-mail.' : null;
    }
    if (email.length > emailMaxLength || !emailPattern.hasMatch(email)) {
      return 'Adresse e-mail invalide.';
    }
    return null;
  }

  static String? phoneError(String raw, {bool required = false}) {
    final phone = raw.trim();
    if (phone.isEmpty) {
      return required ? 'Saisissez un numéro de téléphone.' : null;
    }
    if (phone.length > 32) {
      return 'Numéro de téléphone trop long.';
    }
    return null;
  }

  static String? contactError({required String email, required String phone}) {
    if (email.trim().isEmpty && phone.trim().isEmpty) {
      return 'Indiquez un e-mail ou un numéro de téléphone.';
    }
    return emailError(email) ?? phoneError(phone);
  }

  static String? passwordError(
    String password, {
    String? email,
    String? phone,
  }) {
    final length = password.charactersLength;
    if (length < passwordMinLength) {
      return 'Le mot de passe doit contenir au moins $passwordMinLength caractères.';
    }
    if (length > passwordMaxLength) {
      return 'Le mot de passe est trop long.';
    }
    final lowered = password.toLowerCase();
    if (_commonPasswords.contains(lowered)) {
      return 'Choisissez un mot de passe moins courant.';
    }
    if (lowered.split('').toSet().length < 4) {
      return 'Le mot de passe est trop répétitif.';
    }
    final local = email?.split('@').first;
    if (local != null &&
        local.length >= 4 &&
        lowered.contains(local.toLowerCase())) {
      return 'Le mot de passe ne doit pas contenir votre e-mail.';
    }
    final digits = phone?.replaceAll(RegExp(r'\D'), '');
    if (digits != null &&
        digits.length >= 8 &&
        lowered.contains(digits.substring(digits.length - 8))) {
      return 'Le mot de passe ne doit pas contenir votre numéro.';
    }
    return null;
  }

  static String? confirmPasswordError(String password, String confirmation) {
    if (confirmation != password) {
      return 'Les mots de passe ne correspondent pas.';
    }
    return null;
  }

  static String? otpError(String raw) {
    final code = raw.trim();
    if (!RegExp(r'^\d{4,10}$').hasMatch(code)) {
      return 'Saisissez le code reçu (chiffres uniquement).';
    }
    return null;
  }

  static String? resetTokenError(String raw) {
    final token = raw.trim();
    if (token.length < 20 || token.length > 256) {
      return 'Le lien de réinitialisation est incomplet.';
    }
    return null;
  }
}

extension on String {
  int get charactersLength => length;
}

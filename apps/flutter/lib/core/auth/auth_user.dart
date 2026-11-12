import '../json/json_map.dart';

/// Profil public Identity (`UserResponseDto`).
class AuthUser {
  const AuthUser({
    required this.id,
    required this.status,
    required this.emailVerified,
    required this.phoneVerified,
    required this.roles,
    required this.createdAt,
    this.email,
    this.phone,
    this.firstName,
    this.lastName,
  });

  final String id;
  final String status;
  final bool emailVerified;
  final bool phoneVerified;
  final List<String> roles;
  final DateTime createdAt;
  final String? email;
  final String? phone;
  final String? firstName;
  final String? lastName;

  bool get isPending => status == 'PENDING';

  bool get isOwner => roles.contains('OWNER');

  bool get isAgency => roles.contains('AGENCY');

  bool get isAgent => roles.contains('AGENT');

  /// Rôles autorisés à publier et gérer des biens (Nest PUBLISHER_PERMISSIONS).
  bool get isPublisher => isOwner || isAgency || isAgent;

  String get publisherSpaceLabel {
    if (isAgency) {
      return 'Espace agence';
    }
    if (isOwner) {
      return 'Espace propriétaire';
    }
    if (isAgent) {
      return 'Espace agent';
    }
    return 'Espace de publication';
  }

  bool get needsEmailVerification =>
      email != null && email!.isNotEmpty && !emailVerified;

  bool get needsPhoneVerification =>
      phone != null && phone!.isNotEmpty && !phoneVerified;

  bool get needsVerification =>
      needsEmailVerification || needsPhoneVerification;

  String get displayName {
    final parts = <String>[?firstName, ?lastName];
    if (parts.isNotEmpty) {
      return parts.join(' ');
    }
    return email ?? phone ?? 'Compte';
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'status': status,
      'emailVerified': emailVerified,
      'phoneVerified': phoneVerified,
      'roles': roles,
      'createdAt': createdAt.toUtc().toIso8601String(),
      'email': email,
      'phone': phone,
      'firstName': firstName,
      'lastName': lastName,
    };
  }

  static AuthUser fromJson(Map<String, Object?> json) {
    final id = asNonEmptyString(json['id']);
    if (id == null) {
      throw const FormatException('Profil utilisateur incomplet.');
    }
    final roles = <String>[];
    final rawRoles = json['roles'];
    if (rawRoles is List) {
      for (final role in rawRoles) {
        final value = asNonEmptyString(role);
        if (value != null) {
          roles.add(value);
        }
      }
    }
    return AuthUser(
      id: id,
      status: asNonEmptyString(json['status']) ?? 'UNKNOWN',
      emailVerified: json['emailVerified'] == true,
      phoneVerified: json['phoneVerified'] == true,
      roles: roles,
      createdAt:
          DateTime.tryParse(asNonEmptyString(json['createdAt']) ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      email: asNonEmptyString(json['email']),
      phone: asNonEmptyString(json['phone']),
      firstName: asNonEmptyString(json['firstName']),
      lastName: asNonEmptyString(json['lastName']),
    );
  }
}

/// Erreur applicative exposée à l'UI et aux dépôts.
///
/// Distingue réseau, timeout, HTTP métier (codes Nest) et configuration.
sealed class AppFailure implements Exception {
  const AppFailure({
    required this.message,
    this.code,
    this.statusCode,
    this.requestId,
  });

  final String message;
  final String? code;
  final int? statusCode;
  final String? requestId;

  @override
  String toString() =>
      'AppFailure(code: $code, status: $statusCode, message: $message)';
}

final class NetworkFailure extends AppFailure {
  const NetworkFailure({
    super.message =
        'Impossible de joindre le serveur. Vérifiez votre connexion.',
    super.code = 'NETWORK_UNAVAILABLE',
    super.requestId,
  });
}

final class TimeoutFailure extends AppFailure {
  const TimeoutFailure({
    super.message = 'Le serveur met trop de temps à répondre.',
    super.code = 'NETWORK_TIMEOUT',
    super.requestId,
  });
}

final class HttpFailure extends AppFailure {
  const HttpFailure({
    required super.message,
    super.code,
    super.statusCode,
    super.requestId,
  });

  bool get isUnauthenticated => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
}

final class ParsingFailure extends AppFailure {
  const ParsingFailure({
    super.message = 'Réponse du serveur inattendue.',
    super.code = 'RESPONSE_PARSING_FAILED',
    super.requestId,
  });
}

final class ConfigurationFailure extends AppFailure {
  const ConfigurationFailure({
    super.message = 'L\'URL de l\'API n\'est pas configurée. Relancez l\'application avec API_BASE_URL.',
    super.code = 'API_BASE_URL_MISSING',
  });
}

final class UnexpectedFailure extends AppFailure {
  const UnexpectedFailure({
    super.message = 'Une erreur inattendue s\'est produite.',
    super.code = 'UNEXPECTED',
    super.requestId,
  });
}

final class NeedsAuthFailure extends AppFailure {
  const NeedsAuthFailure({
    super.message = 'Connectez-vous pour continuer. Aucun appel n\'a été envoyé au serveur.',
    super.code = 'UNAUTHENTICATED',
  });
}

final class FavoriteNeedsAuthFailure extends AppFailure {
  const FavoriteNeedsAuthFailure()
    : super(
        message:
            'Connectez-vous pour enregistrer un favori. '
            'Cette action n\'a pas été envoyée au serveur.',
        code: 'UNAUTHENTICATED',
      );
}

final class InquiryValidationFailure extends AppFailure {
  const InquiryValidationFailure(String message)
    : super(message: message, code: 'INVALID_INPUT');
}

final class ListingUnavailableFailure extends AppFailure {
  const ListingUnavailableFailure({super.requestId})
    : super(
        message: 'Cette annonce n\'est plus disponible.',
        code: 'LISTING_NOT_FOUND',
        statusCode: 404,
      );
}

final class InvalidListingIdFailure extends AppFailure {
  const InvalidListingIdFailure()
    : super(
        message: 'Identifiant d\'annonce invalide.',
        code: 'INVALID_LISTING_ID',
      );
}

final class InvalidPropertyIdFailure extends AppFailure {
  const InvalidPropertyIdFailure()
    : super(
        message: 'Identifiant de bien invalide.',
        code: 'INVALID_PROPERTY_ID',
      );
}

final class InvalidConversationIdFailure extends AppFailure {
  const InvalidConversationIdFailure()
    : super(
        message: 'Identifiant de conversation invalide.',
        code: 'INVALID_CONVERSATION_ID',
      );
}

final class ConversationUnavailableFailure extends AppFailure {
  const ConversationUnavailableFailure({super.requestId})
    : super(
        message: 'Cette conversation n\'est plus accessible.',
        code: 'CONVERSATION_NOT_FOUND',
        statusCode: 404,
      );
}

final class InvalidAppointmentIdFailure extends AppFailure {
  const InvalidAppointmentIdFailure()
    : super(
        message: 'Identifiant de visite invalide.',
        code: 'INVALID_APPOINTMENT_ID',
      );
}

final class AppointmentUnavailableFailure extends AppFailure {
  const AppointmentUnavailableFailure({super.requestId})
    : super(
        message: 'Cette visite n\'est plus accessible.',
        code: 'APPOINTMENT_NOT_FOUND',
        statusCode: 404,
      );
}

final class InvalidInquiryIdFailure extends AppFailure {
  const InvalidInquiryIdFailure()
    : super(
        message: 'Identifiant de demande invalide.',
        code: 'INVALID_INQUIRY_ID',
      );
}

final class InquiryUnavailableFailure extends AppFailure {
  const InquiryUnavailableFailure({super.requestId})
    : super(
        message: 'Cette demande n\'est plus accessible.',
        code: 'INQUIRY_NOT_FOUND',
        statusCode: 404,
      );
}

final class AppointmentAlreadyActiveFailure extends AppFailure {
  const AppointmentAlreadyActiveFailure({this.existingId, super.requestId})
    : super(
        message: 'Une visite est déjà en cours pour cette annonce.',
        code: 'APPOINTMENT_ALREADY_ACTIVE',
        statusCode: 409,
      );

  final String? existingId;
}

final class LocationFailure extends AppFailure {
  const LocationFailure({
    super.message = 'La position n\'est pas disponible.',
    super.code = 'LOCATION_UNAVAILABLE',
  });
}

import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/auth/session_store.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';
import '../../listing/domain/listing_media.dart';

class UploadSession {
  const UploadSession({
    required this.sessionId,
    required this.uploadUrl,
    required this.method,
    required this.headers,
    this.mediaId,
  });

  final String sessionId;
  final Uri uploadUrl;
  final String method;
  final Map<String, String> headers;
  final String? mediaId;

  static UploadSession parse(Map<String, Object?> json) {
    final sessionId = asNonEmptyString(json['sessionId']);
    final upload = asJsonMapOrNull(json['upload']);
    final url = asNonEmptyString(upload?['url']);
    if (sessionId == null || url == null) {
      throw const ParsingFailure(message: 'Session d\'envoi inattendue.');
    }
    final headers = <String, String>{};
    final rawHeaders = asJsonMapOrNull(upload?['headers']);
    if (rawHeaders != null) {
      for (final entry in rawHeaders.entries) {
        if (entry.value != null) {
          headers[entry.key] = '${entry.value}';
        }
      }
    }
    return UploadSession(
      sessionId: sessionId,
      uploadUrl: Uri.parse(url),
      method: asNonEmptyString(upload?['method']) ?? 'PUT',
      headers: headers,
      mediaId: asNonEmptyString(json['mediaId']),
    );
  }
}

class MediaUploadRepository {
  MediaUploadRepository({
    required this.client,
    required this.endpoints,
    required this.sessionStore,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final SessionStore sessionStore;

  Future<void> _requireSession() async {
    final token = await sessionStore.readAccessToken();
    if (token == null || token.isEmpty) {
      throw const NeedsAuthFailure();
    }
  }

  Future<ListingMediaPage> list(String propertyId) async {
    await _requireSession();
    final json = await client.getJson(endpoints.propertyMedia(propertyId));
    return ListingMediaPage.fromJson(json);
  }

  Future<ListingMediaItem> uploadImage({
    required String propertyId,
    required List<int> bytes,
    required String mimeType,
    String? filename,
    void Function(int sent, int total)? onProgress,
  }) async {
    await _requireSession();
    if (!PublicIds.isUuid(propertyId)) {
      throw const InvalidPropertyIdFailure();
    }
    final sessionJson = await client.postJson(
      endpoints.mediaUploadSessions(),
      body: {
        'propertyId': propertyId,
        'type': 'IMAGE',
        'mimeType': mimeType,
        'size': bytes.length,
        if (filename != null && filename.isNotEmpty) 'filename': filename,
      },
    );
    final session = UploadSession.parse(sessionJson);
    if (session.method.toUpperCase() != 'PUT') {
      throw const ParsingFailure(
        message: 'Méthode d\'envoi média non prise en charge.',
      );
    }
    await client.putBytes(
      session.uploadUrl,
      bytes: bytes,
      headers: session.headers,
      onProgress: onProgress,
    );
    final completed = await client.postJson(
      endpoints.mediaUploadComplete(session.sessionId),
    );
    final media = asJsonMapOrNull(completed['media']);
    final item = ListingMediaItem.tryParse(media);
    if (item == null) {
      throw const ParsingFailure(
        message: 'Le serveur n\'a pas confirmé le média.',
      );
    }
    return item;
  }

  Future<ListingMediaPage> reorder(
    String propertyId,
    List<String> mediaIds,
  ) async {
    await _requireSession();
    final json = await client.patchJson(
      endpoints.propertyMediaOrder(propertyId),
      body: {'mediaIds': mediaIds},
    );
    return ListingMediaPage.fromJson(json);
  }

  Future<void> setPrimary(String propertyId, String mediaId) async {
    await _requireSession();
    await client.patchJson(
      endpoints.propertyMediaItem(propertyId, mediaId),
      body: {'isPrimary': true},
    );
  }

  Future<void> remove(String propertyId, String mediaId) async {
    await _requireSession();
    await client.deleteJson(endpoints.propertyMediaItem(propertyId, mediaId));
  }
}

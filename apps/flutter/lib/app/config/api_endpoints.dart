/// Construction des URI à partir de l'URL de base Nest vérifiée dans le dépôt.
///
/// Préfixe métier : `/api/v1`. Health : hors préfixe (`/health`, `/health/live`).
class ApiEndpoints {
  ApiEndpoints(this.baseUrl);

  final Uri baseUrl;

  static const apiPrefix = '/api/v1';
  static const healthLivePath = '/health/live';
  static const healthPath = '/health';
  static const metaPath = '/api/v1/meta';

  Uri healthLive() => resolve(healthLivePath);

  Uri health() => resolve(healthPath);

  Uri meta() => resolve(metaPath);

  Uri search() => api('search');

  Uri recommendations() => api('recommendations');

  Uri listings() => api('listings');

  Uri listing(String listingId) => api('listings/$listingId');

  Uri listingPublish(String listingId) => api('listings/$listingId/publish');

  Uri listingPause(String listingId) => api('listings/$listingId/pause');

  Uri listingStatus(String listingId) => api('listings/$listingId/status');

  Uri inquiries() => api('inquiries');

  Uri inquiriesDashboard() => api('inquiries/dashboard');

  Uri inquiry(String inquiryId) => api('inquiries/$inquiryId');

  Uri inquiryNotes(String inquiryId) => api('inquiries/$inquiryId/notes');

  Uri analyticsMeListings() => api('analytics/me/listings');

  Uri properties() => api('properties');

  Uri property(String propertyId) => api('properties/$propertyId');

  Uri propertyAmenities(String propertyId) =>
      api('properties/$propertyId/amenities');

  Uri propertyTypes() => api('property-types');

  Uri amenities() => api('amenities');

  Uri propertyMedia(String propertyId) => api('properties/$propertyId/media');

  Uri propertyMediaOrder(String propertyId) =>
      api('properties/$propertyId/media/order');

  Uri propertyMediaItem(String propertyId, String mediaId) =>
      api('properties/$propertyId/media/$mediaId');

  Uri listingPrice(String listingId) => api('listings/$listingId/price');

  Uri listingHistory(String listingId) => api('listings/$listingId/history');

  Uri mediaUploadSessions() => api('media/upload-sessions');

  Uri mediaUploadSession(String sessionId) =>
      api('media/upload-sessions/$sessionId');

  Uri mediaUploadComplete(String sessionId) =>
      api('media/upload-sessions/$sessionId/complete');

  Uri listingBadges(String listingId) =>
      api('trust/listings/$listingId/badges');

  Uri similarListings(String listingId) =>
      api('recommendations/similar/$listingId');

  Uri favorite(String listingId) => api('interactions/favorites/$listingId');

  Uri listingViews() => api('interactions/views');

  Uri conversations() => api('conversations');

  Uri conversationsUnreadCount() => api('conversations/unread-count');

  Uri conversation(String conversationId) =>
      api('conversations/$conversationId');

  Uri conversationMessages(String conversationId) =>
      api('conversations/$conversationId/messages');

  Uri conversationRead(String conversationId) =>
      api('conversations/$conversationId/read');

  Uri conversationArchive(String conversationId) =>
      api('conversations/$conversationId/archive');

  Uri conversationMute(String conversationId) =>
      api('conversations/$conversationId/mute');

  Uri conversationReport(String conversationId) =>
      api('conversations/$conversationId/report');

  Uri appointments() => api('appointments');

  Uri appointment(String appointmentId) => api('appointments/$appointmentId');

  Uri appointmentConfirm(String appointmentId) =>
      api('appointments/$appointmentId/confirm');

  Uri appointmentReschedule(String appointmentId) =>
      api('appointments/$appointmentId/reschedule');

  Uri appointmentCancel(String appointmentId) =>
      api('appointments/$appointmentId/cancel');

  Uri appointmentComplete(String appointmentId) =>
      api('appointments/$appointmentId/complete');

  Uri appointmentNoShow(String appointmentId) =>
      api('appointments/$appointmentId/no-show');

  Uri appointmentFeedback(String appointmentId) =>
      api('appointments/$appointmentId/feedback');

  Uri favorites() => api('interactions/favorites');

  Uri authRegister() => api('auth/register');

  Uri authLogin() => api('auth/login');

  Uri authRefresh() => api('auth/refresh');

  Uri authLogout() => api('auth/logout');

  Uri authMe() => api('auth/me');

  Uri authForgotPassword() => api('auth/forgot-password');

  Uri authResetPassword() => api('auth/reset-password');

  Uri authEmailVerifyRequest() => api('auth/email/verify/request');

  Uri authEmailVerifyConfirm() => api('auth/email/verify/confirm');

  Uri authPhoneVerifyRequest() => api('auth/phone/verify/request');

  Uri authPhoneVerifyConfirm() => api('auth/phone/verify/confirm');

  Uri authChangePassword() => api('auth/change-password');

  Uri authLogoutAll() => api('auth/logout-all');

  Uri authSessions() => api('auth/sessions');

  Uri authSession(String sessionId) => api('auth/sessions/$sessionId');

  Uri recommendationPreferences() => api('recommendations/preferences');

  Uri savedSearches() => api('saved-searches');

  Uri savedSearch(String id) => api('saved-searches/$id');

  Uri savedSearchResume(String id) => api('saved-searches/$id/resume');

  Uri notificationPreferences() => api('notification-preferences');

  Uri notifications() => api('notifications');

  Uri notificationsUnreadCount() => api('notifications/unread-count');

  Uri notificationsReadAll() => api('notifications/read-all');

  Uri notificationRead(String id) => api('notifications/$id/read');

  Uri pushDevices() => api('push-devices');

  Uri pushDevice(String deviceId) => api('push-devices/$deviceId');

  Uri assistantSearch() => api('ai-assistant/search');

  Uri assistantConversations() => api('ai-assistant/conversations');

  Uri assistantConversation(String conversationId) =>
      api('ai-assistant/conversations/$conversationId');

  Uri assistantConversationMessages(String conversationId) =>
      api('ai-assistant/conversations/$conversationId/messages');

  Uri assistantCompare(String conversationId) =>
      api('ai-assistant/conversations/$conversationId/compare');

  Uri assistantFeedback() => api('ai-assistant/feedback');

  /// Chemin relatif au préfixe `/api/v1`, sans slash initial obligatoire.
  Uri api(String path) {
    final normalized = path.startsWith('/') ? path : '/$path';
    return resolve('$apiPrefix$normalized');
  }

  Uri resolve(String path) {
    final normalized = path.startsWith('/') ? path : '/$path';
    final base = baseUrl.toString().endsWith('/')
        ? baseUrl.toString().substring(0, baseUrl.toString().length - 1)
        : baseUrl.toString();
    return Uri.parse('$base$normalized');
  }
}

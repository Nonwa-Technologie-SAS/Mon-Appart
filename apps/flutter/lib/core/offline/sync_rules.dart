import '../errors/app_failure.dart';
import 'offline_policy.dart';

abstract final class SyncRules {
  static bool isTransient(AppFailure failure) {
    if (failure is NetworkFailure || failure is TimeoutFailure) {
      return true;
    }
    if (failure is HttpFailure) {
      final status = failure.statusCode ?? 0;
      return status == 429 || status == 502 || status == 503 || status == 504;
    }
    return false;
  }

  static bool isUnauthenticated(AppFailure failure) {
    if (failure is HttpFailure) {
      return failure.isUnauthenticated;
    }
    return failure.code == 'UNAUTHENTICATED';
  }

  static bool isPermanent(AppFailure failure) {
    if (isTransient(failure) || isUnauthenticated(failure)) {
      return false;
    }
    if (failure is HttpFailure) {
      final status = failure.statusCode ?? 0;
      return status >= 400 && status < 500;
    }
    return failure is ParsingFailure || failure is InvalidListingIdFailure;
  }

  static DateTime nextAttempt(int attempts, {required DateTime now}) {
    return now.add(OfflinePolicy.backoff(attempts));
  }
}

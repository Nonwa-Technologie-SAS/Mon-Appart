import '../../../core/errors/app_failure.dart';
import 'inquiry.dart';
import 'inquiry_dashboard.dart';
import 'listing_stats.dart';
import 'managed_listing.dart';

enum AnalyticsWindow { days7, days30, days90 }

class ProDashboardSnapshot {
  const ProDashboardSnapshot({
    this.dashboard,
    this.analytics,
    this.analyticsError,
    this.window = AnalyticsWindow.days30,
  });

  final InquiryDashboard? dashboard;
  final ListingStatsPage? analytics;
  final AppFailure? analyticsError;
  final AnalyticsWindow window;

  int get days => switch (window) {
    AnalyticsWindow.days7 => 7,
    AnalyticsWindow.days30 => 30,
    AnalyticsWindow.days90 => 90,
  };
}

class ProListingsSnapshot {
  const ProListingsSnapshot({
    required this.items,
    this.nextCursor,
    this.status,
    this.listingType,
    this.loadingMore = false,
    this.actionError,
  });

  static const empty = ProListingsSnapshot(items: []);

  final List<ManagedListing> items;
  final String? nextCursor;
  final String? status;
  final String? listingType;
  final bool loadingMore;
  final AppFailure? actionError;

  bool get hasMore => nextCursor != null && nextCursor!.isNotEmpty;

  ProListingsSnapshot copyWith({
    List<ManagedListing>? items,
    String? nextCursor,
    String? status,
    String? listingType,
    bool? loadingMore,
    AppFailure? actionError,
    bool clearCursor = false,
    bool clearActionError = false,
    bool clearStatus = false,
    bool clearListingType = false,
  }) {
    return ProListingsSnapshot(
      items: items ?? this.items,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      status: clearStatus ? null : (status ?? this.status),
      listingType: clearListingType ? null : (listingType ?? this.listingType),
      loadingMore: loadingMore ?? this.loadingMore,
      actionError: clearActionError ? null : (actionError ?? this.actionError),
    );
  }
}

class ProLeadsSnapshot {
  const ProLeadsSnapshot({
    required this.items,
    this.nextCursor,
    this.stage,
    this.query,
    this.loadingMore = false,
  });

  static const empty = ProLeadsSnapshot(items: []);

  final List<Inquiry> items;
  final String? nextCursor;
  final String? stage;
  final String? query;
  final bool loadingMore;

  bool get hasMore => nextCursor != null && nextCursor!.isNotEmpty;
}

import '../../../core/errors/app_failure.dart';
import '../../../core/listing/listing_summary.dart';
import 'listing_detail.dart';
import 'listing_media.dart';
import 'listing_trust.dart';

class ListingPage {
  const ListingPage({
    required this.listing,
    this.media = const [],
    this.mediaFailed = false,
    this.trust = const ListingTrust(),
    this.similar = const [],
    this.favorited = false,
    this.favoriteKnown = false,
    this.contactSubmitting = false,
    this.visitSubmitting = false,
    this.actionError,
    this.fromCache = false,
    this.cachedAt,
    this.stale = false,
  });

  final ListingDetail listing;
  final List<ListingMediaItem> media;
  final bool mediaFailed;
  final ListingTrust trust;
  final List<ListingSummary> similar;
  final bool favorited;
  final bool favoriteKnown;
  final bool contactSubmitting;
  final bool visitSubmitting;
  final AppFailure? actionError;
  final bool fromCache;
  final DateTime? cachedAt;
  final bool stale;

  List<ListingMediaItem> get gallery {
    if (media.isNotEmpty) {
      return media;
    }
    final cover = listing.coverUrl;
    if (cover == null) {
      return const [];
    }
    return [
      ListingMediaItem(
        id: 'cover',
        type: 'IMAGE',
        sortOrder: 0,
        cardUrl: cover,
        fullUrl: cover,
        isPrimary: true,
      ),
    ];
  }

  ListingPage copyWith({
    List<ListingMediaItem>? media,
    bool? mediaFailed,
    ListingTrust? trust,
    List<ListingSummary>? similar,
    bool? favorited,
    bool? favoriteKnown,
    bool? contactSubmitting,
    bool? visitSubmitting,
    AppFailure? actionError,
    bool clearActionError = false,
    bool? fromCache,
    DateTime? cachedAt,
    bool? stale,
  }) {
    return ListingPage(
      listing: listing,
      media: media ?? this.media,
      mediaFailed: mediaFailed ?? this.mediaFailed,
      trust: trust ?? this.trust,
      similar: similar ?? this.similar,
      favorited: favorited ?? this.favorited,
      favoriteKnown: favoriteKnown ?? this.favoriteKnown,
      contactSubmitting: contactSubmitting ?? this.contactSubmitting,
      visitSubmitting: visitSubmitting ?? this.visitSubmitting,
      actionError: clearActionError ? null : (actionError ?? this.actionError),
      fromCache: fromCache ?? this.fromCache,
      cachedAt: cachedAt ?? this.cachedAt,
      stale: stale ?? this.stale,
    );
  }
}

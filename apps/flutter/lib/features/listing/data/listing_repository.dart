import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/listing_summary.dart';
import '../../../core/listing/public_ids.dart';
import '../../../core/listing/recommendation_feed.dart';
import '../../../core/offline/cache_read.dart';
import '../../../core/offline/cached_envelope.dart';
import '../../../core/offline/offline_cache.dart';
import '../domain/listing_detail.dart';
import '../domain/listing_media.dart';
import '../domain/listing_trust.dart';

/// Lectures publiques de fiche, médias, badges et similaires.
class ListingRepository {
  ListingRepository({
    required this.client,
    required this.endpoints,
    this.cache,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final OfflineCache? cache;

  Future<ListingDetail> getById(String listingId) async {
    final read = await readById(listingId);
    return read.value;
  }

  Future<CachedRead<ListingDetail>> readById(String listingId) async {
    if (!PublicIds.isUuid(listingId)) {
      throw const InvalidListingIdFailure();
    }
    final id = listingId.trim();
    final local = cache;
    if (local == null) {
      return CachedRead(
        value: await _fetchDetail(id),
        fetchedAt: DateTime.now().toUtc(),
        fromCache: false,
      );
    }
    try {
      return await readThroughCache(
        remote: () => client.getJson(endpoints.listing(id)),
        persist: (json) => local.putListing(id, json),
        local: () => local.getListing(id),
        parse: ListingDetail.fromJson,
        now: () => local.now,
      );
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw ListingUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    } on FormatException catch (error) {
      throw ParsingFailure(message: error.message);
    }
  }

  Future<ListingDetail> _fetchDetail(String listingId) async {
    try {
      final json = await client.getJson(endpoints.listing(listingId));
      return ListingDetail.fromJson(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw ListingUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    } on AppFailure {
      rethrow;
    } on FormatException catch (error) {
      throw ParsingFailure(message: error.message);
    }
  }

  Future<ListingMediaPage> media(String propertyId) async {
    final json = await client.getJson(endpoints.propertyMedia(propertyId));
    return ListingMediaPage.fromJson(json);
  }

  Future<ListingTrust> badges(String listingId) async {
    final json = await client.getJson(endpoints.listingBadges(listingId));
    return ListingTrust.fromJson(json);
  }

  Future<List<ListingSummary>> similar(String listingId) async {
    final json = await client.getJson(
      endpoints.similarListings(listingId),
      query: const {'limit': '6'},
    );
    return RecommendationFeed.fromJson(json).items
        .where((item) => item.listingId != listingId)
        .toList();
  }

  Future<void> recordView(String listingId, {String source = 'DIRECT'}) {
    return client.postJson(
      endpoints.listingViews(),
      body: {'listingId': listingId, 'source': source},
    );
  }
}

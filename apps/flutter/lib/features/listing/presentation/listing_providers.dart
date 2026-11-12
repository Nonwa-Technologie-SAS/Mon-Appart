import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../app/router/deep_link_resolver.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/listing_summary.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../core/offline/offline_policy.dart';
import '../../favorites/presentation/favorites_providers.dart';
import '../../messaging/domain/conversation.dart';
import '../../visits/domain/visit.dart';
import '../../visits/presentation/visits_providers.dart';
import '../data/listing_inquiry_repository.dart';
import '../data/listing_repository.dart';
import '../data/listing_share.dart';
import '../domain/listing_media.dart';
import '../domain/listing_page.dart';
import '../domain/listing_share_text.dart';
import '../domain/listing_trust.dart';

final listingRepositoryProvider = Provider<ListingRepository>((ref) {
  return ListingRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    cache: ref.watch(offlineCacheProvider),
  );
});

final listingInquiryRepositoryProvider = Provider<ListingInquiryRepository>((
  ref,
) {
  return ListingInquiryRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    sessionStore: ref.watch(sessionStoreProvider),
  );
});

final listingShareProvider = Provider<ListingShare>((ref) {
  return const SystemListingShare();
});

class ListingController extends AsyncNotifier<ListingPage> {
  ListingController(this.listingId);

  final String listingId;
  var _generation = 0;

  @override
  Future<ListingPage> build() async {
    final generation = ++_generation;
    final read = await ref.read(listingRepositoryProvider).readById(listingId);
    final listing = read.value;
    if (generation != _generation) {
      return state.value ??
          ListingPage(
            listing: listing,
            fromCache: read.fromCache,
            cachedAt: read.fetchedAt,
          );
    }

    unawaited(_recordView(listing.listingId));

    final mediaFuture = _loadMedia(listing.propertyId);
    final trustFuture = _loadTrust(listing.listingId);
    final similarFuture = _loadSimilar(listing.listingId);
    final favoriteFuture = _loadFavorite(listing.listingId);
    final media = await mediaFuture;
    final trust = await trustFuture;
    final similar = await similarFuture;
    final favorite = await favoriteFuture;
    if (generation != _generation) {
      return state.value ?? ListingPage(listing: listing);
    }
    return ListingPage(
      listing: listing,
      media: media.items,
      mediaFailed: media.failed,
      trust: trust,
      similar: similar,
      favorited: favorite ?? false,
      favoriteKnown: favorite != null,
      fromCache: read.fromCache,
      cachedAt: read.fetchedAt,
      stale: read.isStale(
        OfflinePolicy.staleListings,
        now: DateTime.now().toUtc(),
      ),
    );
  }

  void retry() {
    ref.invalidateSelf();
  }

  Future<void> toggleFavorite() async {
    final current = state.value;
    if (current == null) {
      return;
    }
    if (ref
            .read(favoritesControllerProvider)
            .value
            ?.isBusy(current.listing.listingId) ??
        false) {
      return;
    }
    final previous = current.favorited;
    state = AsyncData(
      current.copyWith(
        favorited: !previous,
        favoriteKnown: true,
        clearActionError: true,
      ),
    );
    try {
      final next = await ref
          .read(favoritesControllerProvider.notifier)
          .toggle(
            current.listing.listingId,
            currentlyFavorite: previous,
            title: current.listing.title,
            propertyId: current.listing.propertyId,
          );
      final latest = state.value ?? current;
      state = AsyncData(latest.copyWith(favorited: next, favoriteKnown: true));
    } catch (error) {
      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(
          favorited: previous,
          actionError: error is AppFailure
              ? error
              : UnexpectedFailure(message: error.toString()),
        ),
      );
    }
  }

  Future<void> share() {
    final listing = state.value?.listing;
    if (listing == null) {
      return Future.value();
    }
    return ref
        .read(listingShareProvider)
        .shareText(
          ListingShareText.of(
            listing,
            publicUrl: DeepLinkResolver.publicListingUrl(
              host: ref.read(appConfigProvider).publicWebHost,
              listingId: listing.listingId,
            ),
          ),
        );
  }

  Future<StartConversationResult?> sendContact(String message) async {
    final current = state.value;
    if (current == null || current.contactSubmitting) {
      return null;
    }
    state = AsyncData(
      current.copyWith(contactSubmitting: true, clearActionError: true),
    );
    try {
      final started = await ref
          .read(listingInquiryRepositoryProvider)
          .contact(listingId: current.listing.listingId, message: message);
      final latest = state.value ?? current;
      state = AsyncData(latest.copyWith(contactSubmitting: false));
      return started;
    } catch (error) {
      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(
          contactSubmitting: false,
          actionError: error is AppFailure
              ? error
              : UnexpectedFailure(message: error.toString()),
        ),
      );
      rethrow;
    }
  }

  Future<VisitRequestResult?> sendVisit(
    DateTime scheduledAt,
    String notes,
  ) async {
    final current = state.value;
    if (current == null || current.visitSubmitting) {
      return null;
    }
    state = AsyncData(
      current.copyWith(visitSubmitting: true, clearActionError: true),
    );
    try {
      final result = await ref
          .read(visitRepositoryProvider)
          .request(
            listingId: current.listing.listingId,
            scheduledAt: scheduledAt,
            notes: notes,
          );
      final latest = state.value ?? current;
      state = AsyncData(latest.copyWith(visitSubmitting: false));
      return result;
    } catch (error) {
      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(
          visitSubmitting: false,
          actionError: error is AppFailure
              ? error
              : UnexpectedFailure(message: error.toString()),
        ),
      );
      rethrow;
    }
  }

  Future<({List<ListingMediaItem> items, bool failed})> _loadMedia(
    String propertyId,
  ) async {
    try {
      final page = await ref.read(listingRepositoryProvider).media(propertyId);
      return (items: page.images, failed: false);
    } catch (_) {
      return (items: const <ListingMediaItem>[], failed: true);
    }
  }

  Future<ListingTrust> _loadTrust(String id) async {
    try {
      return await ref.read(listingRepositoryProvider).badges(id);
    } catch (_) {
      return const ListingTrust();
    }
  }

  Future<List<ListingSummary>> _loadSimilar(String id) async {
    try {
      return await ref.read(listingRepositoryProvider).similar(id);
    } catch (_) {
      return const [];
    }
  }

  Future<bool?> _loadFavorite(String id) async {
    try {
      return await ref.read(favoriteRepositoryProvider).isFavorite(id);
    } catch (_) {
      return null;
    }
  }

  Future<void> _recordView(String id) async {
    try {
      await ref.read(listingRepositoryProvider).recordView(id);
    } catch (_) {}
  }
}

final listingControllerProvider =
    AsyncNotifierProvider.family<ListingController, ListingPage, String>(
      ListingController.new,
      retry: (_, _) => null,
    );

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/offline/offline_messages.dart';
import '../../../core/listing/listing_summary.dart';
import 'favorites_providers.dart';

Future<void> toggleFavoriteFromCard({
  required BuildContext context,
  required WidgetRef ref,
  required ListingSummary listing,
  required String loginNext,
}) {
  return toggleFavoriteForListing(
    context: context,
    ref: ref,
    listingId: listing.listingId,
    title: listing.title,
    propertyId: listing.propertyId,
    loginNext: loginNext,
  );
}

Future<void> toggleFavoriteForListing({
  required BuildContext context,
  required WidgetRef ref,
  required String listingId,
  required String loginNext,
  String? title,
  String? propertyId,
}) async {
  try {
    final currentlyFavorite =
        ref.read(favoritesControllerProvider).value?.contains(listingId) ??
        false;
    await ref
        .read(favoritesControllerProvider.notifier)
        .toggle(
          listingId,
          currentlyFavorite: currentlyFavorite,
          title: title,
          propertyId: propertyId,
        );
    if (!context.mounted) {
      return;
    }
    final queued =
        ref.read(favoritesControllerProvider).value?.isQueued(listingId) ??
        false;
    if (queued) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(OfflineMessages.queuedFavorite)),
      );
    }
  } on FavoriteNeedsAuthFailure catch (error) {
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(error.message)));
    await context.push(AppRoutes.loginWithNext(loginNext));
  } on AppFailure catch (error) {
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(error.message)));
  }
}

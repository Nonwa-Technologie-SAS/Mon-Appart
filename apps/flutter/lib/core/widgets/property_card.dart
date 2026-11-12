import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';
import '../../app/theme/app_radii.dart';
import '../../app/theme/app_shadows.dart';
import '../../app/theme/app_spacing.dart';
import '../listing/listing_summary.dart';
import 'favorite_button.dart';
import 'price_label.dart';
import 'property_image.dart';
import 'status_badge.dart';

/// Carte immobilière alimentée par un [ListingSummary] Nest.
class PropertyCard extends StatelessWidget {
  const PropertyCard({
    super.key,
    required this.listing,
    this.onTap,
    this.onFavorite,
    this.isFavorite = false,
    this.favoriteEnabled = true,
  });

  final ListingSummary listing;
  final VoidCallback? onTap;
  final VoidCallback? onFavorite;
  final bool isFavorite;
  final bool favoriteEnabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final specs = listing.specsLabel;
    return Semantics(
      button: onTap != null,
      label:
          '${listing.title}, ${listing.locationLabel}, ${listing.priceLabel}',
      child: Material(
        color: AppColors.card,
        elevation: 0,
        shape: const RoundedRectangleBorder(
          borderRadius: AppRadii.card,
          side: BorderSide(color: AppColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: DecoratedBox(
            decoration: const BoxDecoration(boxShadow: AppShadows.card),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AspectRatio(
                  aspectRatio: 16 / 10,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      PropertyImage(
                        url: listing.mainImageUrl,
                        semanticLabel: 'Photo de ${listing.title}',
                      ),
                      Positioned(
                        top: AppSpacing.xs,
                        left: AppSpacing.xs,
                        child: StatusBadge(label: listing.listingTypeLabel),
                      ),
                      if (onFavorite != null)
                        Positioned(
                          top: AppSpacing.xxs,
                          right: AppSpacing.xxs,
                          child: Material(
                            color: AppColors.card.withValues(alpha: 0.92),
                            shape: const CircleBorder(),
                            child: FavoriteButton(
                              isFavorite: isFavorite,
                              enabled: favoriteEnabled,
                              onPressed: onFavorite!,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      PriceLabel(price: listing.price),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        listing.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleSmall,
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        listing.locationLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall,
                      ),
                      if (specs != null) ...[
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          '${listing.propertyTypeName} · $specs',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelSmall,
                        ),
                      ] else
                        Text(
                          listing.propertyTypeName,
                          style: theme.textTheme.labelSmall,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

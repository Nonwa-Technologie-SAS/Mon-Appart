import 'package:flutter/material.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/property_image.dart';
import '../domain/listing_media.dart';

class ListingGallery extends StatelessWidget {
  const ListingGallery({
    super.key,
    required this.items,
    required this.controller,
    required this.index,
    required this.onIndexChanged,
    required this.onOpenViewer,
    this.failed = false,
    this.onRetry,
  });

  final List<ListingMediaItem> items;
  final PageController controller;
  final int index;
  final ValueChanged<int> onIndexChanged;
  final ValueChanged<int> onOpenViewer;
  final bool failed;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return AspectRatio(
        aspectRatio: 16 / 10,
        child: ColoredBox(
          color: AppColors.muted,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                failed ? Icons.wifi_off_outlined : Icons.photo_outlined,
                size: 40,
                color: AppColors.mutedForeground,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                failed
                    ? 'Les photos n\'ont pas pu être chargées.'
                    : 'Aucune photo pour cette annonce.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              if (failed && onRetry != null)
                TextButton(onPressed: onRetry, child: const Text('Réessayer')),
            ],
          ),
        ),
      );
    }

    return AspectRatio(
      aspectRatio: 16 / 10,
      child: Stack(
        fit: StackFit.expand,
        children: [
          PageView.builder(
            controller: controller,
            itemCount: items.length,
            onPageChanged: onIndexChanged,
            itemBuilder: (context, i) {
              final item = items[i];
              return GestureDetector(
                onTap: () => onOpenViewer(i),
                child: PropertyImage(
                  url: item.previewUrl,
                  semanticLabel: 'Photo ${i + 1} sur ${items.length}',
                ),
              );
            },
          ),
          Positioned(
            right: AppSpacing.sm,
            bottom: AppSpacing.sm,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: AppColors.foreground.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(AppSpacing.xs),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xxs,
                ),
                child: Text(
                  '${index + 1} / ${items.length}',
                  style: Theme.of(context).textTheme.labelMedium
                      ?.copyWith(color: AppColors.primaryForeground),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

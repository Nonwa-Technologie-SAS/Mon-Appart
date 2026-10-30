import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';

class PropertyImage extends StatelessWidget {
  const PropertyImage({super.key, required this.url, this.semanticLabel});

  final String? url;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final placeholder = ColoredBox(
      color: AppColors.muted,
      child: Center(
        child: Icon(
          Icons.apartment_outlined,
          size: 40,
          color: AppColors.primary.withValues(alpha: 0.7),
          semanticLabel: url == null || url!.isEmpty
              ? 'Photo non disponible'
              : 'Chargement de la photo',
        ),
      ),
    );

    final imageUrl = url;
    if (imageUrl == null || imageUrl.isEmpty) {
      return Semantics(
        label: semanticLabel ?? 'Photo non disponible',
        image: true,
        child: placeholder,
      );
    }

    final width = MediaQuery.sizeOf(context).width;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final cacheWidth = (width * dpr).round().clamp(160, 1200);

    return Semantics(
      label: semanticLabel ?? 'Photo du bien',
      image: true,
      child: CachedNetworkImage(
        imageUrl: imageUrl,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        memCacheWidth: cacheWidth,
        fadeInDuration: const Duration(milliseconds: 180),
        placeholder: (context, _) => placeholder,
        errorWidget: (context, _, _) => const ColoredBox(
          color: AppColors.muted,
          child: Center(
            child: Icon(
              Icons.broken_image_outlined,
              size: 36,
              color: AppColors.mutedForeground,
              semanticLabel: 'Photo indisponible',
            ),
          ),
        ),
      ),
    );
  }
}

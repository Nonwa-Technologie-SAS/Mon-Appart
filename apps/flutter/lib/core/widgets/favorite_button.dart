import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/theme/app_colors.dart';
import '../../app/theme/app_spacing.dart';

class FavoriteButton extends StatelessWidget {
  const FavoriteButton({
    super.key,
    required this.isFavorite,
    required this.onPressed,
    this.enabled = true,
  });

  final bool isFavorite;
  final VoidCallback onPressed;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final label = isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris';
    return SizedBox(
      width: AppSpacing.touchTarget,
      height: AppSpacing.touchTarget,
      child: IconButton(
        tooltip: label,
        onPressed: enabled
            ? () {
                HapticFeedback.selectionClick();
                onPressed();
              }
            : null,
        icon: Icon(
          isFavorite ? Icons.favorite : Icons.favorite_border,
          color: isFavorite ? AppColors.destructive : AppColors.foreground,
        ),
      ),
    );
  }
}

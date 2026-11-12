import 'package:flutter/material.dart';

import '../../app/theme/app_spacing.dart';

enum AppButtonVariant { primary, secondary, outline }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.icon,
    this.expand = true,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final IconData? icon;
  final bool expand;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading) ...[
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: AppSpacing.xs),
        ] else if (icon != null) ...[
          Icon(icon, size: 20),
          const SizedBox(width: AppSpacing.xs),
        ],
        Flexible(child: Text(label)),
      ],
    );

    final pressed = loading ? null : onPressed;
    final button = switch (variant) {
      AppButtonVariant.primary => ElevatedButton(
        onPressed: pressed,
        child: child,
      ),
      AppButtonVariant.secondary => FilledButton(
        onPressed: pressed,
        child: child,
      ),
      AppButtonVariant.outline => OutlinedButton(
        onPressed: pressed,
        child: child,
      ),
    };

    if (!expand) {
      return button;
    }
    return SizedBox(width: double.infinity, child: button);
  }
}

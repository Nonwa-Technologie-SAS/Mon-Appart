import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/theme/app_spacing.dart';

/// Champ de recherche texte libre. N'interprète pas le langage naturel.
class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.controller,
    required this.onSubmitted,
    this.onChanged,
    this.hintText = 'Appartement à louer à Cocody, maison à Bingerville…',
    this.maxLength = 120,
    this.autofocus = false,
  });

  final TextEditingController controller;
  final ValueChanged<String> onSubmitted;
  final ValueChanged<String>? onChanged;
  final String hintText;
  final int maxLength;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        return TextField(
          controller: controller,
          autofocus: autofocus,
          textInputAction: TextInputAction.search,
          onChanged: onChanged,
          onSubmitted: (text) => onSubmitted(text.trim()),
          inputFormatters: [LengthLimitingTextInputFormatter(maxLength)],
          decoration: InputDecoration(
            hintText: hintText,
            prefixIcon: const Icon(Icons.search),
            suffixIcon: value.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Effacer la recherche',
                    onPressed: () {
                      controller.clear();
                      onChanged?.call('');
                    },
                    icon: const Icon(Icons.close),
                  ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
          ),
        );
      },
    );
  }
}

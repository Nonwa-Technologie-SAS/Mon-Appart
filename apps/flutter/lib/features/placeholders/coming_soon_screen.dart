import 'package:flutter/material.dart';

import '../../app/theme/app_spacing.dart';
import '../../core/widgets/app_empty_state.dart';

class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({
    super.key,
    required this.title,
    required this.message,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: AppEmptyState(
          icon: Icons.hourglass_empty,
          title: title,
          message: message,
        ),
      ),
    );
  }
}

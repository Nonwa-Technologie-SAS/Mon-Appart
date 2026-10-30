import 'package:flutter/material.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../domain/visit_labels.dart';

Future<String?> showVisitCancelSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (context) => const VisitCancelSheet(),
  );
}

class VisitCancelSheet extends StatefulWidget {
  const VisitCancelSheet({super.key});

  @override
  State<VisitCancelSheet> createState() => _VisitCancelSheetState();
}

class _VisitCancelSheetState extends State<VisitCancelSheet> {
  String _reason = VisitCancelReasons.values.first;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.md,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Annuler la visite',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'L\'annulation est transmise au serveur. Choisissez un motif.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.md),
          DropdownButtonFormField<String>(
            initialValue: _reason,
            decoration: const InputDecoration(labelText: 'Motif'),
            items: [
              for (final reason in VisitCancelReasons.values)
                DropdownMenuItem(
                  value: reason,
                  child: Text(VisitLabels.cancelReason(reason)),
                ),
            ],
            onChanged: (value) {
              if (value != null) {
                setState(() => _reason = value);
              }
            },
          ),
          const SizedBox(height: AppSpacing.md),
          AppButton(
            label: 'Confirmer l\'annulation',
            onPressed: () => Navigator.of(context).pop(_reason),
          ),
        ],
      ),
    );
  }
}

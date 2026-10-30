import 'package:flutter/material.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../domain/visit_labels.dart';

class VisitFeedbackDraft {
  const VisitFeedbackDraft({
    required this.outcome,
    required this.shareOutcomeWithOwner,
  });

  final String outcome;
  final bool shareOutcomeWithOwner;
}

Future<VisitFeedbackDraft?> showVisitFeedbackSheet(BuildContext context) {
  return showModalBottomSheet<VisitFeedbackDraft>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => const VisitFeedbackSheet(),
  );
}

class VisitFeedbackSheet extends StatefulWidget {
  const VisitFeedbackSheet({super.key});

  @override
  State<VisitFeedbackSheet> createState() => _VisitFeedbackSheetState();
}

class _VisitFeedbackSheetState extends State<VisitFeedbackSheet> {
  String _outcome = VisitFeedbackOutcomes.values.first;
  var _share = false;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.md + bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Retour après la visite',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Facultatif. La note privée n\'est jamais envoyée ici. '
            'L\'issue n\'est visible de l\'annonceur que si vous la partagez.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.md),
          DropdownButtonFormField<String>(
            initialValue: _outcome,
            decoration: const InputDecoration(labelText: 'Issue'),
            items: [
              for (final outcome in VisitFeedbackOutcomes.values)
                DropdownMenuItem(
                  value: outcome,
                  child: Text(VisitLabels.feedbackOutcome(outcome)),
                ),
            ],
            onChanged: (value) {
              if (value != null) {
                setState(() => _outcome = value);
              }
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Partager l\'issue avec l\'annonceur'),
            value: _share,
            onChanged: (value) => setState(() => _share = value),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Envoyer le retour',
            onPressed: () => Navigator.of(context).pop(
              VisitFeedbackDraft(
                outcome: _outcome,
                shareOutcomeWithOwner: _share,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

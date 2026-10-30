import 'package:flutter/material.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../domain/message_labels.dart';

class ConversationReportDraft {
  const ConversationReportDraft({required this.reason, this.description});

  final String reason;
  final String? description;
}

Future<ConversationReportDraft?> showConversationReportSheet(
  BuildContext context,
) {
  return showModalBottomSheet<ConversationReportDraft>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => const ConversationReportSheet(),
  );
}

class ConversationReportSheet extends StatefulWidget {
  const ConversationReportSheet({super.key});

  @override
  State<ConversationReportSheet> createState() =>
      _ConversationReportSheetState();
}

class _ConversationReportSheetState extends State<ConversationReportSheet> {
  String _reason = ConversationReportReasons.values.first;
  final _description = TextEditingController();

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

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
            'Signaler la conversation',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Le signalement est transmis à la modération. Il n\'est pas public '
            'et ne bloque pas automatiquement l\'interlocuteur.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.md),
          DropdownButtonFormField<String>(
            initialValue: _reason,
            decoration: const InputDecoration(labelText: 'Motif'),
            items: [
              for (final code in ConversationReportReasons.values)
                DropdownMenuItem(
                  value: code,
                  child: Text(MessageLabels.reportReason(code)),
                ),
            ],
            onChanged: (value) {
              if (value != null) {
                setState(() => _reason = value);
              }
            },
          ),
          TextField(
            controller: _description,
            maxLength: 1000,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Précisions (facultatif)',
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AppButton(
            label: 'Envoyer le signalement',
            onPressed: () {
              Navigator.of(context).pop(
                ConversationReportDraft(
                  reason: _reason,
                  description: _description.text.trim().isEmpty
                      ? null
                      : _description.text.trim(),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

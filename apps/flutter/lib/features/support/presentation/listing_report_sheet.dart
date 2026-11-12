import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../domain/own_report.dart';

class ListingReportDraft {
  const ListingReportDraft({required this.reason, this.description});

  final String reason;
  final String? description;
}

Future<ListingReportDraft?> showListingReportSheet(BuildContext context) {
  return showModalBottomSheet<ListingReportDraft>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => const ListingReportSheet(),
  );
}

class ListingReportSheet extends StatefulWidget {
  const ListingReportSheet({super.key});

  @override
  State<ListingReportSheet> createState() => _ListingReportSheetState();
}

class _ListingReportSheetState extends State<ListingReportSheet> {
  String _reason = ListingReportReasons.values.first;
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
            'Signaler cette annonce',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Le signalement est examiné par la modération. Il ne suspend pas '
            'l\'annonce et ne prouve pas une faute. N\'écrivez ni mot de passe, '
            'ni code reçu par SMS.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.md),
          DropdownButtonFormField<String>(
            initialValue: _reason,
            decoration: const InputDecoration(labelText: 'Motif'),
            items: [
              for (final code in ListingReportReasons.values)
                DropdownMenuItem(
                  value: code,
                  child: Text(ListingReportReasons.label(code)),
                ),
            ],
            onChanged: (value) {
              if (value != null) {
                setState(() => _reason = value);
              }
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _description,
            minLines: 2,
            maxLines: 4,
            maxLength: 1000,
            inputFormatters: [LengthLimitingTextInputFormatter(1000)],
            decoration: const InputDecoration(
              labelText: 'Faits observés (facultatif)',
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Envoyer le signalement',
            onPressed: () {
              final text = _description.text.trim();
              Navigator.of(context).pop(
                ListingReportDraft(
                  reason: _reason,
                  description: text.isEmpty ? null : text,
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../../visits/domain/visit_rules.dart';
import '../data/listing_inquiry_repository.dart';

class VisitDraft {
  const VisitDraft({required this.scheduledAt, required this.notes});

  final DateTime scheduledAt;
  final String notes;
}

Future<VisitDraft?> showListingVisitSheet(BuildContext context) {
  return showModalBottomSheet<VisitDraft>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => const ListingVisitSheet(),
  );
}

class ListingVisitSheet extends StatefulWidget {
  const ListingVisitSheet({super.key});

  @override
  State<ListingVisitSheet> createState() => _ListingVisitSheetState();
}

class _ListingVisitSheetState extends State<ListingVisitSheet> {
  final _notes = TextEditingController();
  DateTime? _scheduledAt;
  String? _error;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: VisitRules.maxDaysAhead)),
    );
    if (!mounted || date == null) {
      return;
    }
    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
    );
    if (!mounted || time == null) {
      return;
    }
    setState(() {
      _scheduledAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
      _error = null;
    });
  }

  void _submit() {
    final scheduleError = InquiryRules.scheduleError(_scheduledAt);
    final notesError = InquiryRules.notesError(_notes.text);
    final error = scheduleError ?? notesError;
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    Navigator.of(context)
        .pop(VisitDraft(scheduledAt: _scheduledAt!, notes: _notes.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final label = _scheduledAt == null
        ? 'Choisir une date'
        : DateFormat('dd/MM/yyyy HH:mm').format(_scheduledAt!);
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
            'Demander une visite',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'La demande reste en attente tant que l\'annonceur ne l\'a pas '
            'confirmée. Un créneau proposé n\'est pas un rendez-vous.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: _pickDateTime,
            icon: const Icon(Icons.event),
            label: Text(label),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _notes,
            maxLength: InquiryRules.maxNotesLength,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Message (facultatif)',
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          AppButton(label: 'Envoyer la demande', onPressed: _submit),
        ],
      ),
    );
  }
}

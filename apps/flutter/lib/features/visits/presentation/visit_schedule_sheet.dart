import 'package:flutter/material.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../domain/visit_rules.dart';

class VisitScheduleDraft {
  const VisitScheduleDraft({required this.scheduledAt});

  final DateTime scheduledAt;
}

Future<VisitScheduleDraft?> showVisitScheduleSheet(
  BuildContext context, {
  required String title,
  required String message,
  String submitLabel = 'Envoyer',
}) {
  return showModalBottomSheet<VisitScheduleDraft>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => VisitScheduleSheet(
      title: title,
      message: message,
      submitLabel: submitLabel,
    ),
  );
}

class VisitScheduleSheet extends StatefulWidget {
  const VisitScheduleSheet({
    super.key,
    required this.title,
    required this.message,
    required this.submitLabel,
  });

  final String title;
  final String message;
  final String submitLabel;

  @override
  State<VisitScheduleSheet> createState() => _VisitScheduleSheetState();
}

class _VisitScheduleSheetState extends State<VisitScheduleSheet> {
  DateTime? _scheduledAt;
  String? _error;

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
    final error = VisitRules.scheduleError(_scheduledAt);
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    Navigator.of(context).pop(VisitScheduleDraft(scheduledAt: _scheduledAt!));
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final label = _scheduledAt == null
        ? 'Choisir une date'
        : '${_scheduledAt!.day.toString().padLeft(2, '0')}/'
              '${_scheduledAt!.month.toString().padLeft(2, '0')}/'
              '${_scheduledAt!.year} '
              '${_scheduledAt!.hour.toString().padLeft(2, '0')}:'
              '${_scheduledAt!.minute.toString().padLeft(2, '0')}';
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
          Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(widget.message, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: _pickDateTime,
            icon: const Icon(Icons.event),
            label: Text(label),
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
          AppButton(label: widget.submitLabel, onPressed: _submit),
        ],
      ),
    );
  }
}

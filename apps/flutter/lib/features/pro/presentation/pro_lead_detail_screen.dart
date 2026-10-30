import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/status_badge.dart';
import '../../notifications/domain/relative_time.dart';
import '../../visits/domain/visit_labels.dart';
import '../domain/inquiry.dart';
import '../domain/inquiry_labels.dart';
import 'pro_access.dart';
import 'pro_providers.dart';

class ProLeadDetailScreen extends StatelessWidget {
  const ProLeadDetailScreen({super.key, required this.inquiryId});

  final String inquiryId;

  @override
  Widget build(BuildContext context) {
    return ProAccessScope(
      title: 'Prospect',
      nextRoute: AppRoutes.proLead(inquiryId),
      child: _LeadDetailBody(inquiryId: inquiryId),
    );
  }
}

class _LeadDetailBody extends ConsumerWidget {
  const _LeadDetailBody({required this.inquiryId});

  final String inquiryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(leadControllerProvider(inquiryId));
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement du prospect'),
      error: (error, _) {
        final failure = asAppFailure(error);
        if (failure is InvalidInquiryIdFailure ||
            failure is InquiryUnavailableFailure ||
            (failure is HttpFailure && failure.isNotFound)) {
          return AppEmptyState(
            icon: Icons.person_off_outlined,
            title: 'Prospect introuvable',
            message: failure.message,
          );
        }
        return proFailureView(
          context: context,
          failure: failure,
          loginNext: AppRoutes.proLead(inquiryId),
          onRetry: () =>
              ref.read(leadControllerProvider(inquiryId).notifier).retry(),
        );
      },
      data: (inquiry) => _LeadDetailContent(inquiry: inquiry),
    );
  }
}

class _LeadDetailContent extends ConsumerStatefulWidget {
  const _LeadDetailContent({required this.inquiry});

  final Inquiry inquiry;

  @override
  ConsumerState<_LeadDetailContent> createState() => _LeadDetailContentState();
}

class _LeadDetailContentState extends ConsumerState<_LeadDetailContent> {
  final _note = TextEditingController();
  var _submitting = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final inquiry = widget.inquiry;
    final theme = Theme.of(context);
    final next = InquiryStageRules.nextStages(inquiry.stage);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        Text(
          inquiry.prospect.displayName,
          style: theme.textTheme.headlineSmall,
        ),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            StatusBadge(
              label: InquiryLabels.stage(inquiry.stage),
              tone: InquiryLabels.tone(inquiry.stage),
            ),
            StatusBadge(
              label: InquiryLabels.status(inquiry.status),
              tone: StatusBadgeTone.neutral,
            ),
            StatusBadge(
              label: InquiryLabels.origin(inquiry.type),
              tone: StatusBadgeTone.accent,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.home_work_outlined),
          title: Text(inquiry.listingTitle),
          subtitle: const Text('Fiche du bien'),
          onTap: () => context.push(AppRoutes.listing(inquiry.listingId)),
        ),
        if (inquiry.conversationId != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.chat_bubble_outline),
            title: const Text('Ouvrir la conversation'),
            onTap: () =>
                context.push(AppRoutes.conversation(inquiry.conversationId!)),
          ),
        if (inquiry.message != null) ...[
          Text('Message', style: theme.textTheme.titleMedium),
          Text(inquiry.message!),
          const SizedBox(height: AppSpacing.md),
        ],
        if (inquiry.desiredZone != null)
          Text('Zone souhaitée : ${inquiry.desiredZone}'),
        if (inquiry.nextAction != null)
          Text('Prochaine action : ${inquiry.nextAction}'),
        if (inquiry.lostReason != null)
          Text('Motif : ${InquiryLabels.lostReason(inquiry.lostReason!)}'),
        Text(
          'Dernière activité ${RelativeTime.format(inquiry.lastActivityAt)}',
          style: theme.textTheme.bodySmall,
        ),
        if (inquiry.appointments.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text('Visites associées', style: theme.textTheme.titleMedium),
          for (final visit in inquiry.appointments)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(VisitLabels.status(visit.status)),
              subtitle: Text(VisitLabels.dateTime(visit.scheduledAt)),
              onTap: () => context.push(AppRoutes.appointment(visit.id)),
            ),
        ],
        const SizedBox(height: AppSpacing.md),
        Text('Statut commercial', style: theme.textTheme.titleMedium),
        if (next.isEmpty)
          const Text('Aucune transition disponible depuis ce statut.')
        else
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              for (final stage in next)
                ActionChip(
                  label: Text(InquiryLabels.stage(stage)),
                  onPressed: _submitting
                      ? null
                      : () => _changeStage(inquiry, stage),
                ),
            ],
          ),
        const SizedBox(height: AppSpacing.lg),
        Text('Note interne', style: theme.textTheme.titleMedium),
        const Text(
          'Jamais visible du prospect, jamais envoyée en conversation.',
        ),
        TextField(
          controller: _note,
          minLines: 2,
          maxLines: 4,
          enabled: !_submitting,
          decoration: const InputDecoration(hintText: 'Ajouter une note'),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Enregistrer la note',
          loading: _submitting,
          onPressed: _submitting ? null : _addNote,
        ),
        if (inquiry.notes.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          for (final note in inquiry.notes)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(note.body),
              subtitle: Text(
                '${note.authorName} · ${RelativeTime.format(note.createdAt)}',
              ),
            ),
        ],
        if (inquiry.stageHistory.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text('Historique', style: theme.textTheme.titleMedium),
          for (final event in inquiry.stageHistory)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                event.fromStage == null
                    ? InquiryLabels.stage(event.toStage)
                    : '${InquiryLabels.stage(event.fromStage!)} → ${InquiryLabels.stage(event.toStage)}',
              ),
              subtitle: Text(
                '${event.authorName} · ${RelativeTime.format(event.createdAt)}',
              ),
            ),
        ],
      ],
    );
  }

  Future<void> _changeStage(Inquiry inquiry, String stage) async {
    String? lostReason;
    if (stage == 'LOST') {
      lostReason = await showModalBottomSheet<String>(
        context: context,
        builder: (context) {
          return SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const ListTile(title: Text('Motif de perte')),
                for (final reason in InquiryLabels.lostReasons)
                  ListTile(
                    title: Text(InquiryLabels.lostReason(reason)),
                    onTap: () => Navigator.of(context).pop(reason),
                  ),
              ],
            ),
          );
        },
      );
      if (lostReason == null) {
        return;
      }
    }
    setState(() => _submitting = true);
    try {
      await ref
          .read(leadControllerProvider(inquiry.id).notifier)
          .updateStage(stage, lostReason: lostReason);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Statut : ${InquiryLabels.stage(stage)}')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(asAppFailure(error).message)));
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _addNote() async {
    final body = _note.text.trim();
    if (body.length < 2) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('La note est trop courte.')));
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref
          .read(leadControllerProvider(widget.inquiry.id).notifier)
          .addNote(body);
      _note.clear();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(asAppFailure(error).message)));
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }
}

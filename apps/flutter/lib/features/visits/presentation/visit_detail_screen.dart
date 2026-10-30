import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/status_badge.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/visit.dart';
import '../domain/visit_labels.dart';
import '../domain/visits_snapshot.dart';
import 'visit_cancel_sheet.dart';
import 'visit_feedback_sheet.dart';
import 'visit_schedule_sheet.dart';
import 'visits_providers.dart';

class VisitDetailScreen extends ConsumerWidget {
  const VisitDetailScreen({super.key, required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).value;
    return Scaffold(
      appBar: AppBar(title: const Text('Visite')),
      body: session?.isAuthenticated != true
          ? AppEmptyState(
              icon: Icons.lock_outline,
              title: 'Connexion requise',
              message:
                  'Connectez-vous pour consulter cette visite. '
                  'Ouvrir une notification ne confirme pas le rendez-vous.',
              actionLabel: 'Se connecter',
              onAction: () => context.push(
                AppRoutes.loginWithNext(AppRoutes.appointment(appointmentId)),
              ),
            )
          : _VisitDetailBody(appointmentId: appointmentId),
    );
  }
}

class _VisitDetailBody extends ConsumerWidget {
  const _VisitDetailBody({required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(visitControllerProvider(appointmentId));
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement de la visite'),
      error: (error, _) {
        final failure = error is AppFailure
            ? error
            : UnexpectedFailure(message: error.toString());
        if (failure is NeedsAuthFailure ||
            (failure is HttpFailure && failure.isUnauthenticated)) {
          return AppEmptyState(
            icon: Icons.lock_outline,
            title: 'Session expirée',
            message: failure.message,
            actionLabel: 'Se connecter',
            onAction: () => context.push(
              AppRoutes.loginWithNext(AppRoutes.appointment(appointmentId)),
            ),
          );
        }
        if (failure is InvalidAppointmentIdFailure ||
            failure is AppointmentUnavailableFailure ||
            (failure is HttpFailure && failure.isNotFound)) {
          return AppEmptyState(
            icon: Icons.event_busy_outlined,
            title: 'Visite inaccessible',
            message: failure.message,
          );
        }
        return AppErrorView(
          failure: failure,
          onRetry: () =>
              ref.read(visitControllerProvider(appointmentId).notifier).retry(),
        );
      },
      data: (snapshot) =>
          _VisitContent(snapshot: snapshot, appointmentId: appointmentId),
    );
  }
}

class _VisitContent extends ConsumerWidget {
  const _VisitContent({required this.snapshot, required this.appointmentId});

  final VisitDetailSnapshot snapshot;
  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visit = snapshot.visit;
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        StatusBadge(
          label: VisitLabels.status(visit.status),
          tone: VisitLabels.tone(visit.status),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(visit.listingTitle, style: theme.textTheme.headlineSmall),
        const SizedBox(height: AppSpacing.xs),
        Text(
          VisitLabels.dateTime(visit.scheduledAt),
          style: theme.textTheme.titleMedium,
        ),
        Text(
          'Fuseau ${visit.timezone} · ${visit.durationMinutes} min',
          style: theme.textTheme.bodySmall,
        ),
        const SizedBox(height: AppSpacing.md),
        Text('Demandeur : ${visit.requester.displayName}'),
        Text('Votre rôle : ${VisitLabels.side(visit.side)}'),
        if (visit.notes != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text('Message', style: theme.textTheme.titleSmall),
          Text(visit.notes!),
        ],
        if (visit.status == 'RESCHEDULE_REQUESTED' &&
            visit.proposedAt != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Nouvelle date proposée'
            '${visit.proposedBy != null ? ' (${VisitLabels.side(visit.proposedBy!)})' : ''} : '
            '${VisitLabels.dateTime(visit.proposedAt!)}',
          ),
          const Text(
            'Cette proposition n\'est pas confirmée tant que l\'autre partie ne l\'a pas acceptée.',
          ),
        ],
        if (visit.status == 'PENDING')
          const Padding(
            padding: EdgeInsets.only(top: AppSpacing.sm),
            child: Text('Cette demande n\'est pas un rendez-vous confirmé.'),
          ),
        if (visit.cancellationReason != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Motif d\'annulation : ${VisitLabels.cancelReason(visit.cancellationReason!)}',
          ),
        ],
        if (visit.feedback.submitted) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Retour envoyé'
            '${visit.feedback.outcome != null ? ' : ${VisitLabels.feedbackOutcome(visit.feedback.outcome!)}' : ''}.',
          ),
        ],
        if (snapshot.actionError != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            snapshot.actionError!.message,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.error,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        AppButton(
          label: 'Voir l\'annonce',
          variant: AppButtonVariant.outline,
          onPressed: () => context.push(AppRoutes.listing(visit.listingId)),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Préparer l\'itinéraire',
          variant: AppButtonVariant.outline,
          icon: Icons.route_outlined,
          onPressed: () => context.push(
            Uri(
              path: AppRoutes.visitTour,
              queryParameters: {'ids': visit.id},
            ).toString(),
          ),
        ),
        if (visit.conversationId != null) ...[
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Ouvrir la conversation',
            variant: AppButtonVariant.outline,
            onPressed: () =>
                context.push(AppRoutes.conversation(visit.conversationId!)),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        for (final action in visit.actions) ...[
          AppButton(
            label: VisitLabels.action(action),
            variant: action == 'CANCEL' || action == 'NO_SHOW'
                ? AppButtonVariant.outline
                : AppButtonVariant.primary,
            loading: snapshot.submitting,
            onPressed: snapshot.submitting
                ? null
                : () => _onAction(context, ref, visit, action),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (visit.canSubmitFeedback)
          AppButton(
            label: 'Laisser un retour',
            variant: AppButtonVariant.outline,
            loading: snapshot.submitting,
            onPressed: snapshot.submitting
                ? null
                : () => _onFeedback(context, ref),
          ),
      ],
    );
  }

  Future<void> _onAction(
    BuildContext context,
    WidgetRef ref,
    Visit visit,
    String action,
  ) async {
    final controller = ref.read(
      visitControllerProvider(appointmentId).notifier,
    );
    try {
      switch (action) {
        case 'CONFIRM':
          await controller.confirm();
          if (context.mounted) {
            _snack(context, 'Visite confirmée.');
          }
        case 'RESCHEDULE':
          final draft = await showVisitScheduleSheet(
            context,
            title: 'Proposer une autre date',
            message:
                'La nouvelle date reste une proposition. '
                'Elle n\'est pas confirmée tant que l\'autre partie ne l\'accepte pas.',
            submitLabel: 'Proposer cette date',
          );
          if (draft == null || !context.mounted) {
            return;
          }
          await controller.reschedule(draft.scheduledAt);
          if (context.mounted) {
            _snack(
              context,
              'Nouvelle date proposée. Elle n\'est pas encore confirmée.',
            );
          }
        case 'CANCEL':
          final reason = await showVisitCancelSheet(context);
          if (reason == null || !context.mounted) {
            return;
          }
          await controller.cancel(reason);
          if (context.mounted) {
            _snack(context, 'Visite annulée.');
          }
        case 'COMPLETE':
          await controller.complete();
          if (context.mounted) {
            _snack(context, 'Visite marquée comme effectuée.');
          }
        case 'NO_SHOW':
          await controller.noShow();
          if (context.mounted) {
            _snack(context, 'Visite marquée comme non honorée.');
          }
      }
    } on AppFailure catch (error) {
      if (context.mounted) {
        _snack(context, error.message);
      }
    }
  }

  Future<void> _onFeedback(BuildContext context, WidgetRef ref) async {
    final draft = await showVisitFeedbackSheet(context);
    if (draft == null || !context.mounted) {
      return;
    }
    try {
      await ref
          .read(visitControllerProvider(appointmentId).notifier)
          .submitFeedback(
            outcome: draft.outcome,
            shareOutcomeWithOwner: draft.shareOutcomeWithOwner,
          );
      if (context.mounted) {
        _snack(context, 'Retour enregistré.');
      }
    } on AppFailure catch (error) {
      if (context.mounted) {
        _snack(context, error.message);
      }
    }
  }

  void _snack(BuildContext context, String message) {
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}

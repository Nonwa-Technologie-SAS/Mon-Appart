import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_radii.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/status_badge.dart';
import '../../notifications/domain/relative_time.dart';
import '../domain/inquiry.dart';
import '../domain/inquiry_labels.dart';
import '../domain/pro_snapshots.dart';
import 'pro_access.dart';
import 'pro_providers.dart';

class ProLeadsScreen extends StatelessWidget {
  const ProLeadsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ProAccessScope(
      title: 'Mes prospects',
      nextRoute: AppRoutes.proLeads,
      child: _LeadsBody(),
    );
  }
}

class _LeadsBody extends ConsumerStatefulWidget {
  const _LeadsBody();

  @override
  ConsumerState<_LeadsBody> createState() => _LeadsBodyState();
}

class _LeadsBodyState extends ConsumerState<_LeadsBody> {
  late final TextEditingController _query;

  @override
  void initState() {
    super.initState();
    _query = TextEditingController();
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(proLeadsControllerProvider);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            0,
          ),
          child: TextField(
            controller: _query,
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(
              hintText: 'Rechercher par titre d\'annonce',
              prefixIcon: Icon(Icons.search),
            ),
            onSubmitted: (value) {
              ref
                  .read(proLeadsControllerProvider.notifier)
                  .setQuery(value.trim().isEmpty ? null : value.trim());
            },
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            children: [
              Padding(
                padding: const EdgeInsets.only(right: AppSpacing.xs),
                child: FilterChip(
                  label: const Text('Tous'),
                  selected: async.value?.stage == null,
                  onSelected: (_) {
                    ref
                        .read(proLeadsControllerProvider.notifier)
                        .setStage(null);
                  },
                ),
              ),
              for (final stage in InquiryLabels.stages)
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.xs),
                  child: FilterChip(
                    label: Text(InquiryLabels.stage(stage)),
                    selected: async.value?.stage == stage,
                    onSelected: (_) {
                      ref
                          .read(proLeadsControllerProvider.notifier)
                          .setStage(stage);
                    },
                  ),
                ),
            ],
          ),
        ),
        Expanded(child: _LeadsList(async: async)),
      ],
    );
  }
}

class _LeadsList extends ConsumerWidget {
  const _LeadsList({required this.async});

  final AsyncValue<ProLeadsSnapshot> async;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement des prospects'),
      error: (error, _) => proFailureView(
        context: context,
        failure: asAppFailure(error),
        loginNext: AppRoutes.proLeads,
        onRetry: () => ref.read(proLeadsControllerProvider.notifier).refresh(),
      ),
      data: (snapshot) {
        if (snapshot.items.isEmpty) {
          return const AppEmptyState(
            icon: Icons.people_outline,
            title: 'Aucun prospect',
            message:
                'Les demandes de contact et de visite sur vos annonces '
                'apparaissent ici, sans duplication artificielle.',
          );
        }
        return RefreshIndicator(
          onRefresh: () =>
              ref.read(proLeadsControllerProvider.notifier).refresh(),
          child: NotificationListener<ScrollNotification>(
            onNotification: (notification) {
              if (notification.metrics.pixels >
                  notification.metrics.maxScrollExtent - 240) {
                ref.read(proLeadsControllerProvider.notifier).loadMore();
              }
              return false;
            },
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: snapshot.items.length + (snapshot.loadingMore ? 1 : 0),
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) {
                if (index >= snapshot.items.length) {
                  return const Padding(
                    padding: EdgeInsets.all(AppSpacing.md),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                return _LeadTile(inquiry: snapshot.items[index]);
              },
            ),
          ),
        );
      },
    );
  }
}

class _LeadTile extends StatelessWidget {
  const _LeadTile({required this.inquiry});

  final Inquiry inquiry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: AppColors.card,
      borderRadius: AppRadii.card,
      child: InkWell(
        borderRadius: AppRadii.card,
        onTap: () => context.push(AppRoutes.proLead(inquiry.id)),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      inquiry.prospect.displayName,
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  StatusBadge(
                    label: InquiryLabels.stage(inquiry.stage),
                    tone: InquiryLabels.tone(inquiry.stage),
                  ),
                ],
              ),
              Text(inquiry.listingTitle, style: theme.textTheme.bodyMedium),
              Text(
                '${InquiryLabels.origin(inquiry.type)} · '
                '${RelativeTime.format(inquiry.lastActivityAt)}',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.mutedForeground,
                ),
              ),
              if (inquiry.nextAction != null)
                Text(
                  'Prochaine action : ${inquiry.nextAction}',
                  style: theme.textTheme.bodySmall,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

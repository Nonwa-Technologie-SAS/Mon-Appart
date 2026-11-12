import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_radii.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_loading.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../notifications/domain/relative_time.dart';
import '../domain/conversation.dart';
import '../domain/message_labels.dart';
import 'messaging_providers.dart';

class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).value;
    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: session?.isAuthenticated != true
          ? AppEmptyState(
              icon: Icons.lock_outline,
              title: 'Connexion requise',
              message:
                  'Connectez-vous pour voir vos échanges avec les annonceurs. '
                  'L\'accès à chaque conversation reste contrôlé par le serveur.',
              actionLabel: 'Se connecter',
              onAction: () =>
                  context.push(AppRoutes.loginWithNext(AppRoutes.messages)),
            )
          : const _ConversationsList(),
    );
  }
}

class _ConversationsList extends ConsumerWidget {
  const _ConversationsList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(conversationsControllerProvider);
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const AppLoading(label: 'Chargement des conversations'),
      error: (error, _) {
        final failure = error is AppFailure
            ? error
            : UnexpectedFailure(message: error.toString());
        if (failure is HttpFailure && failure.isUnauthenticated) {
          return AppEmptyState(
            icon: Icons.lock_outline,
            title: 'Session expirée',
            message: failure.message,
            actionLabel: 'Se connecter',
            onAction: () =>
                context.push(AppRoutes.loginWithNext(AppRoutes.messages)),
          );
        }
        return AppErrorView(
          failure: failure,
          onRetry: () =>
              ref.read(conversationsControllerProvider.notifier).refresh(),
        );
      },
      data: (snapshot) {
        if (snapshot.items.isEmpty) {
          return AppEmptyState(
            icon: Icons.chat_bubble_outline,
            title: 'Aucun message',
            message:
                'Contactez un propriétaire ou une agence depuis une annonce '
                'pour démarrer une conversation.',
            actionLabel: 'Découvrir les biens',
            onAction: () => context.go(AppRoutes.explore),
          );
        }
        return RefreshIndicator(
          onRefresh: () =>
              ref.read(conversationsControllerProvider.notifier).refresh(),
          child: NotificationListener<ScrollNotification>(
            onNotification: (notification) {
              if (notification.metrics.pixels >
                  notification.metrics.maxScrollExtent - 120) {
                ref.read(conversationsControllerProvider.notifier).loadMore();
              }
              return false;
            },
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: snapshot.items.length + (snapshot.loadingMore ? 1 : 0),
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.xs),
              itemBuilder: (context, index) {
                if (index >= snapshot.items.length) {
                  return const Padding(
                    padding: EdgeInsets.all(AppSpacing.md),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                final conversation = snapshot.items[index];
                return _ConversationTile(conversation: conversation);
              },
            ),
          ),
        );
      },
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.conversation});

  final Conversation conversation;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unread = conversation.unread > 0;
    final initials = _initials(conversation.counterpartName);
    return Material(
      color: AppColors.card,
      borderRadius: AppRadii.card,
      child: InkWell(
        borderRadius: AppRadii.card,
        onTap: () => context.push(AppRoutes.conversation(conversation.id)),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: AppColors.accent,
                foregroundColor: AppColors.accentForeground,
                child: Text(initials),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            conversation.counterpartName,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: unread
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                          ),
                        ),
                        Text(
                          RelativeTime.format(conversation.lastActivityAt),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppColors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '${conversation.listing.typeLabel} · ${conversation.listing.title}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      MessageLabels.preview(conversation.lastMessage),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: unread ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
              if (unread) ...[
                const SizedBox(width: AppSpacing.xs),
                _UnreadBadge(count: conversation.unread),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) {
      return 'A';
    }
    if (parts.length == 1) {
      return parts.first[0].toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

class _UnreadBadge extends StatelessWidget {
  const _UnreadBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final label = count > 99 ? '99+' : '$count';
    return Container(
      constraints: const BoxConstraints(minWidth: 22),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: const BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.all(Radius.circular(999)),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: AppColors.primaryForeground,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

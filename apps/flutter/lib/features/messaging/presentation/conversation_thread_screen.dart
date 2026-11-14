import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_radii.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/public_ids.dart';
import '../../../core/security/screen_privacy.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/status_badge.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../listing/data/listing_inquiry_repository.dart';
import '../../notifications/domain/relative_time.dart';
import '../domain/chat_message.dart';
import '../domain/conversation.dart';
import '../domain/message_labels.dart';
import '../domain/thread_snapshot.dart';
import 'conversation_report_sheet.dart';
import 'messaging_providers.dart';

class ConversationThreadScreen extends ConsumerStatefulWidget {
  const ConversationThreadScreen({super.key, required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<ConversationThreadScreen> createState() =>
      _ConversationThreadScreenState();
}

class _ConversationThreadScreenState
    extends ConsumerState<ConversationThreadScreen>
    with WidgetsBindingObserver {
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  var _showJump = false;
  final _privacy = SensitiveScreenBinding();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _scroll.addListener(_onScroll);
    _privacy.attach(ref);
  }

  @override
  void dispose() {
    _privacy.detach();
    WidgetsBinding.instance.removeObserver(this);
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _composer.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        PublicIds.isUuid(widget.conversationId)) {
      ref
          .read(threadControllerProvider(widget.conversationId).notifier)
          .catchUp();
    }
  }

  void _onScroll() {
    if (!_scroll.hasClients) {
      return;
    }
    final away = _scroll.position.pixels > 80;
    if (away != _showJump) {
      setState(() => _showJump = away);
    }
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 80) {
      ref
          .read(threadControllerProvider(widget.conversationId).notifier)
          .loadOlder();
    }
  }

  Future<void> _send() async {
    final text = _composer.text;
    if (InquiryRules.messageError(text) != null) {
      return;
    }
    try {
      await ref
          .read(threadControllerProvider(widget.conversationId).notifier)
          .send(text);
      _composer.clear();
      if (_scroll.hasClients) {
        await _scroll.animateTo(
          0,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _report() async {
    final draft = await showConversationReportSheet(context);
    if (draft == null || !mounted) {
      return;
    }
    try {
      await ref
          .read(threadControllerProvider(widget.conversationId).notifier)
          .report(reason: draft.reason, description: draft.description);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Signalement transmis à la modération. Il n\'est pas public.',
          ),
        ),
      );
    } on AppFailure catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).value;
    if (session?.isAuthenticated != true) {
      return Scaffold(
        appBar: AppBar(title: const Text('Conversation')),
        body: AppEmptyState(
          icon: Icons.lock_outline,
          title: 'Connexion requise',
          message:
              'Connectez-vous pour ouvrir cette destination. '
              'L\'accès définitif reste contrôlé par le serveur.',
          actionLabel: 'Se connecter',
          onAction: () => context.push(
            AppRoutes.loginWithNext(
              AppRoutes.conversation(widget.conversationId),
            ),
          ),
        ),
      );
    }
    if (!PublicIds.isUuid(widget.conversationId)) {
      return Scaffold(
        appBar: AppBar(title: const Text('Conversation')),
        body: const AppEmptyState(
          icon: Icons.link_off,
          title: 'Conversation introuvable',
          message: 'Cet identifiant de conversation n\'est pas valide.',
        ),
      );
    }
    final async = ref.watch(threadControllerProvider(widget.conversationId));
    return Scaffold(
      appBar: AppBar(
        title: Text(
          async.value?.conversation.counterpartName ?? 'Conversation',
        ),
        actions: [
          if (async.value != null)
            PopupMenuButton<_ThreadMenu>(
              onSelected: (value) async {
                final notifier = ref.read(
                  threadControllerProvider(widget.conversationId).notifier,
                );
                switch (value) {
                  case _ThreadMenu.archive:
                    try {
                      await notifier.archive(
                        !async.value!.conversation.archived,
                      );
                    } on AppFailure catch (error) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(
                          context,
                        ).showSnackBar(SnackBar(content: Text(error.message)));
                      }
                    }
                  case _ThreadMenu.mute:
                    try {
                      await notifier.mute(!async.value!.conversation.muted);
                    } on AppFailure catch (error) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(
                          context,
                        ).showSnackBar(SnackBar(content: Text(error.message)));
                      }
                    }
                  case _ThreadMenu.report:
                    await _report();
                }
              },
              itemBuilder: (context) {
                final conversation = async.value!.conversation;
                return [
                  PopupMenuItem(
                    value: _ThreadMenu.archive,
                    child: Text(
                      conversation.archived ? 'Désarchiver' : 'Archiver',
                    ),
                  ),
                  PopupMenuItem(
                    value: _ThreadMenu.mute,
                    child: Text(
                      conversation.muted
                          ? 'Réactiver les notifications'
                          : 'Couper les notifications',
                    ),
                  ),
                  const PopupMenuItem(
                    value: _ThreadMenu.report,
                    child: Text('Signaler'),
                  ),
                ];
              },
            ),
        ],
      ),
      body: async.when(
        skipLoadingOnReload: true,
        loading: () => const AppLoading(label: 'Chargement de la conversation'),
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
                AppRoutes.loginWithNext(
                  AppRoutes.conversation(widget.conversationId),
                ),
              ),
            );
          }
          if (failure is InvalidConversationIdFailure ||
              failure is ConversationUnavailableFailure ||
              (failure is HttpFailure && failure.isNotFound)) {
            return AppEmptyState(
              icon: Icons.chat_bubble_outline,
              title: 'Conversation inaccessible',
              message: failure.message,
            );
          }
          return AppErrorView(
            failure: failure,
            onRetry: () => ref
                .read(threadControllerProvider(widget.conversationId).notifier)
                .retry(),
          );
        },
        data: (snapshot) => _ThreadBody(
          snapshot: snapshot,
          scroll: _scroll,
          composer: _composer,
          showJump: _showJump,
          onSend: _send,
          onJump: () {
            if (_scroll.hasClients) {
              _scroll.animateTo(
                0,
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
              );
            }
          },
        ),
      ),
    );
  }
}

enum _ThreadMenu { archive, mute, report }

class _ThreadBody extends StatelessWidget {
  const _ThreadBody({
    required this.snapshot,
    required this.scroll,
    required this.composer,
    required this.showJump,
    required this.onSend,
    required this.onJump,
  });

  final ThreadSnapshot snapshot;
  final ScrollController scroll;
  final TextEditingController composer;
  final bool showJump;
  final VoidCallback onSend;
  final VoidCallback onJump;

  @override
  Widget build(BuildContext context) {
    final conversation = snapshot.conversation;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Column(
      children: [
        _ListingContextCard(listing: conversation.listing),
        if (conversation.isClosed)
          const Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.xs,
              AppSpacing.md,
              0,
            ),
            child: StatusBadge(
              label: 'Conversation fermée',
              tone: StatusBadgeTone.warning,
            ),
          ),
        Expanded(
          child: Stack(
            children: [
              ListView.builder(
                controller: scroll,
                reverse: true,
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount:
                    snapshot.messages.length + (snapshot.loadingOlder ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index == snapshot.messages.length) {
                    return const Padding(
                      padding: EdgeInsets.all(AppSpacing.md),
                      child: Center(child: CircularProgressIndicator()),
                    );
                  }
                  final messages = snapshot.messages;
                  final message = messages[messages.length - 1 - index];
                  final previous = index + 1 < messages.length
                      ? messages[messages.length - 2 - index]
                      : null;
                  final showDate =
                      previous == null ||
                      !_sameDay(previous.createdAt, message.createdAt);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (showDate) _DaySeparator(date: message.createdAt),
                      _MessageBubble(message: message),
                    ],
                  );
                },
              ),
              if (showJump)
                Positioned(
                  right: AppSpacing.md,
                  bottom: AppSpacing.md,
                  child: FloatingActionButton.small(
                    onPressed: onJump,
                    tooltip: 'Derniers messages',
                    child: const Icon(Icons.arrow_downward),
                  ),
                ),
            ],
          ),
        ),
        if (snapshot.sendError != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Text(
              snapshot.sendError!.message,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: AppColors.destructive),
            ),
          ),
        SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.xs,
              AppSpacing.md,
              AppSpacing.sm + bottom,
            ),
            child: conversation.isClosed
                ? Text(
                    'Cette conversation est fermée. L\'historique reste consultable.',
                    style: Theme.of(context).textTheme.bodySmall,
                  )
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: TextField(
                          controller: composer,
                          minLines: 1,
                          maxLines: 4,
                          maxLength: InquiryRules.maxMessageLength,
                          enabled: !snapshot.sending,
                          textInputAction: TextInputAction.newline,
                          decoration: const InputDecoration(
                            hintText: 'Votre message',
                            counterText: '',
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      IconButton.filled(
                        onPressed: snapshot.sending ? null : onSend,
                        tooltip: 'Envoyer',
                        icon: snapshot.sending
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.send),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  static bool _sameDay(DateTime a, DateTime b) {
    final left = a.toLocal();
    final right = b.toLocal();
    return left.year == right.year &&
        left.month == right.month &&
        left.day == right.day;
  }
}

class _ListingContextCard extends StatelessWidget {
  const _ListingContextCard({required this.listing});

  final ConversationListing listing;

  @override
  Widget build(BuildContext context) {
    final status = listing.statusLabel;
    return Material(
      color: AppColors.accent,
      child: InkWell(
        onTap: listing.isPublished
            ? () => context.push(AppRoutes.listing(listing.id))
            : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: [
              const Icon(
                Icons.home_work_outlined,
                color: AppColors.accentForeground,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      listing.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    Text(
                      listing.typeLabel,
                      style: Theme.of(context).textTheme.bodySmall
                          ?.copyWith(color: AppColors.mutedForeground),
                    ),
                    if (status != null)
                      Text(
                        status,
                        style: Theme.of(context).textTheme.bodySmall
                            ?.copyWith(color: AppColors.warning),
                      ),
                  ],
                ),
              ),
              if (listing.isPublished)
                const Icon(
                  Icons.chevron_right,
                  color: AppColors.mutedForeground,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DaySeparator extends StatelessWidget {
  const _DaySeparator({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final local = date.toLocal();
    final label =
        '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}/'
        '${local.year}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Center(
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall
              ?.copyWith(color: AppColors.mutedForeground),
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    if (message.isSystem) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Center(
          child: Text(
            MessageLabels.system(message.systemCode),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: AppColors.mutedForeground),
          ),
        ),
      );
    }
    final mine = message.mine;
    final align = mine ? Alignment.centerRight : Alignment.centerLeft;
    final color = mine ? AppColors.primary : AppColors.muted;
    final foreground = mine
        ? AppColors.primaryForeground
        : AppColors.foreground;
    return Align(
      alignment: align,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 320),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(AppRadii.lg),
          ),
          child: Column(
            crossAxisAlignment: mine
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              if (!mine && message.author != null)
                Text(
                  message.author!.displayName,
                  style: Theme.of(context).textTheme.labelSmall
                      ?.copyWith(color: foreground.withValues(alpha: 0.8)),
                ),
              Text(
                message.deleted ? 'Message retiré.' : (message.body ?? ''),
                style: Theme.of(context).textTheme.bodyMedium
                    ?.copyWith(color: foreground),
              ),
              for (final attachment in message.attachments)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xxs),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        attachment.type == 'IMAGE'
                            ? Icons.image_outlined
                            : Icons.attach_file,
                        size: 16,
                        color: foreground,
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          attachment.ready
                              ? attachment.label
                              : '${attachment.label} (en préparation)',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: foreground),
                        ),
                      ),
                    ],
                  ),
                ),
              for (final hint in message.safetyHints)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xs),
                  child: Text(
                    hint.userMessage,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: mine ? AppColors.secondary : AppColors.warning,
                    ),
                  ),
                ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                [
                  RelativeTime.format(message.createdAt),
                  ?MessageLabels.deliveryStatus(message),
                ].join(' · '),
                style: Theme.of(context).textTheme.labelSmall
                    ?.copyWith(color: foreground.withValues(alpha: 0.8)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/auth/auth_user.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/section_header.dart';
import '../../../core/widgets/status_badge.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../messaging/presentation/messaging_providers.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncSession = ref.watch(authControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Compte')),
      body: asyncSession.when(
        skipLoadingOnReload: true,
        loading: () => const AppLoading(label: 'Chargement du compte'),
        error: (error, _) => AppEmptyState(
          icon: Icons.wifi_off_outlined,
          title: 'Compte indisponible',
          message: error is AppFailure
              ? error.message
              : 'Impossible de charger le compte.',
          actionLabel: 'Réessayer',
          onAction: () => ref.invalidate(authControllerProvider),
        ),
        data: (session) {
          final user = session.user;
          if (user == null) {
            return Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                children: [
                  const AppEmptyState(
                    icon: Icons.person_outline,
                    title: 'Vous n\'êtes pas connecté',
                    message:
                        'La consultation des annonces reste possible sans compte. '
                        'Connectez-vous pour le profil, les favoris et les préférences.',
                    compact: true,
                  ),
                  if (session.restoreError != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: Text(
                        'Session locale non vérifiée : ${session.restoreError!.message}',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  AppButton(
                    label: 'Se connecter',
                    onPressed: () => context.push(AppRoutes.login),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppButton(
                    label: 'Créer un compte',
                    variant: AppButtonVariant.outline,
                    onPressed: () => context.push(AppRoutes.register),
                  ),
                ],
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              _ProfileHeader(user: user),
              if (session.restoreError != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Profil affiché depuis l\'appareil. '
                  'Le serveur n\'a pas confirmé la session : ${session.restoreError!.message}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(title: 'Espace personnel'),
              const _MessagesTile(),
              const _VisitsTile(),
              _AccountTile(
                icon: Icons.edit_outlined,
                title: 'Modifier le profil',
                subtitle: 'Prénom et nom uniquement',
                onTap: () => context.push(AppRoutes.editProfile),
              ),
              _AccountTile(
                icon: Icons.tune_outlined,
                title: 'Préférences immobilières',
                subtitle: 'Budget, zones et caractéristiques',
                onTap: () => context.push(AppRoutes.housingPreferences),
              ),
              _AccountTile(
                icon: Icons.favorite_outline,
                title: 'Favoris',
                subtitle: 'Annonces enregistrées',
                onTap: () => context.go(AppRoutes.favorites),
              ),
              _AccountTile(
                icon: Icons.compare_arrows,
                title: 'Comparaison',
                subtitle: 'Shortlist locale, non synchronisée',
                onTap: () => context.push(AppRoutes.compare),
              ),
              _AccountTile(
                icon: Icons.bookmark_outline,
                title: 'Recherches enregistrées',
                subtitle: 'Relancer ou supprimer une alerte',
                onTap: () => context.push(AppRoutes.savedSearches),
              ),
              if (user.isPublisher) ...[
                const SizedBox(height: AppSpacing.md),
                SectionHeader(title: user.publisherSpaceLabel),
                _AccountTile(
                  icon: Icons.insights_outlined,
                  title: 'Tableau de bord',
                  subtitle: 'Indicateurs commerciaux des biens gérés',
                  onTap: () => context.push(AppRoutes.pro),
                ),
                _AccountTile(
                  icon: Icons.home_work_outlined,
                  title: 'Mes annonces',
                  subtitle: 'Statuts et actions du gestionnaire',
                  onTap: () => context.push(AppRoutes.proListings),
                ),
                _AccountTile(
                  icon: Icons.people_outline,
                  title: 'Mes prospects',
                  subtitle: 'Demandes de contact et de visite',
                  onTap: () => context.push(AppRoutes.proLeads),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              const SectionHeader(title: 'Paramètres'),
              _AccountTile(
                icon: Icons.notifications_outlined,
                title: 'Notifications',
                subtitle: 'Catégories et canaux Nest',
                onTap: () => context.push(AppRoutes.notificationPreferences),
              ),
              _AccountTile(
                icon: Icons.lock_outline,
                title: 'Sécurité',
                subtitle: 'Mot de passe et sessions',
                onTap: () => context.push(AppRoutes.accountSecurity),
              ),
              _AccountTile(
                icon: Icons.privacy_tip_outlined,
                title: 'Confidentialité',
                subtitle: 'Données utilisées par le compte',
                onTap: () => context.push(AppRoutes.accountPrivacy),
              ),
              _AccountTile(
                icon: Icons.diversity_3_outlined,
                title: 'Club Mon Appart',
                subtitle: 'Programme non ouvert : aucun point ni avantage',
                onTap: () => context.push(AppRoutes.club),
              ),
              _AccountTile(
                icon: Icons.support_agent_outlined,
                title: 'Centre d\'aide',
                subtitle: 'Questions, signalements et canaux configurés',
                onTap: () => context.push(AppRoutes.help),
              ),
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: 'Se déconnecter',
                variant: AppButtonVariant.outline,
                loading: session.submitting,
                onPressed: () async {
                  await ref.read(authControllerProvider.notifier).logout();
                },
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.user});

  final AuthUser user;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initials = _initials(user);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 32,
          child: Text(initials, style: theme.textTheme.titleLarge),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(user.displayName, style: theme.textTheme.headlineSmall),
              if (user.firstName == null && user.lastName == null)
                Text(
                  'Complétez votre nom pour personnaliser le compte.',
                  style: theme.textTheme.bodySmall,
                ),
              const SizedBox(height: AppSpacing.xs),
              if (user.email != null)
                _ContactLine(
                  value: user.email!,
                  verified: user.emailVerified,
                  unverifiedAction: () => context.push(AppRoutes.verifyContact),
                ),
              if (user.phone != null)
                _ContactLine(
                  value: user.phone!,
                  verified: user.phoneVerified,
                  unverifiedAction: () => context.push(AppRoutes.verifyContact),
                ),
              if (user.email == null && user.phone == null)
                Text(
                  'Aucun e-mail ni téléphone renseigné.',
                  style: theme.textTheme.bodySmall,
                ),
              if (user.isPending) ...[
                const SizedBox(height: AppSpacing.xs),
                const StatusBadge(
                  label: 'Vérification du contact en attente',
                  tone: StatusBadgeTone.warning,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  static String _initials(AuthUser user) {
    final first = user.firstName?.trim();
    final last = user.lastName?.trim();
    if (first != null && first.isNotEmpty) {
      final second = (last != null && last.isNotEmpty) ? last[0] : '';
      return '${first[0]}$second'.toUpperCase();
    }
    final fallback = user.email ?? user.phone ?? 'C';
    return fallback[0].toUpperCase();
  }
}

class _ContactLine extends StatelessWidget {
  const _ContactLine({
    required this.value,
    required this.verified,
    required this.unverifiedAction,
  });

  final String value;
  final bool verified;
  final VoidCallback unverifiedAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xxs),
      child: Row(
        children: [
          Expanded(child: Text(value)),
          if (verified)
            const StatusBadge(label: 'Vérifié', tone: StatusBadgeTone.success)
          else
            TextButton(
              onPressed: unverifiedAction,
              child: const Text('Vérifier'),
            ),
        ],
      ),
    );
  }
}

class _VisitsTile extends StatelessWidget {
  const _VisitsTile();

  @override
  Widget build(BuildContext context) {
    return _AccountTile(
      icon: Icons.event_available_outlined,
      title: 'Mes visites',
      subtitle: 'Demandes et rendez-vous',
      onTap: () => context.push(AppRoutes.visits),
    );
  }
}

class _MessagesTile extends ConsumerWidget {
  const _MessagesTile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = ref.watch(conversationsControllerProvider).value;
    final unread = snapshot?.unread ?? 0;
    return _AccountTile(
      icon: Icons.chat_bubble_outline,
      title: 'Messages',
      subtitle: unread > 0
          ? '$unread message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}'
          : 'Conversations avec les annonceurs',
      onTap: () => context.push(AppRoutes.messages),
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}

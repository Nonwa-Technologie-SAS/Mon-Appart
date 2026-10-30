import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/search/explore_query.dart';
import '../../core/widgets/app_empty_state.dart';
import '../../features/account/presentation/account_privacy_screen.dart';
import '../../features/account/presentation/account_screen.dart';
import '../../features/account/presentation/account_security_screen.dart';
import '../../features/account/presentation/account_sessions_screen.dart';
import '../../features/account/presentation/change_password_screen.dart';
import '../../features/account/presentation/edit_profile_screen.dart';
import '../../features/account/presentation/housing_preferences_screen.dart';
import '../../features/account/presentation/notification_preferences_screen.dart';
import '../../features/account/presentation/saved_search_edit_screen.dart';
import '../../features/account/presentation/saved_searches_screen.dart';
import '../../features/config_missing/missing_config_screen.dart';
import '../../features/assistant/presentation/assistant_screen.dart';
import '../../features/compare/presentation/compare_screen.dart';
import '../../features/explore/presentation/explore_filters_screen.dart';
import '../../features/explore/presentation/explore_screen.dart';
import '../../features/favorites/presentation/favorites_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/reset_password_screen.dart';
import '../../features/auth/presentation/verify_contact_screen.dart';
import '../../features/listing/presentation/listing_detail_screen.dart';
import '../../features/messaging/presentation/conversation_thread_screen.dart';
import '../../features/messaging/presentation/conversations_screen.dart';
import '../../features/pro/presentation/pro_dashboard_screen.dart';
import '../../features/pro/presentation/pro_lead_detail_screen.dart';
import '../../features/pro/presentation/pro_leads_screen.dart';
import '../../features/pro/presentation/pro_listings_screen.dart';
import '../../features/visits/presentation/visit_detail_screen.dart';
import '../../features/visits/presentation/visit_tour_screen.dart';
import '../../features/visits/presentation/visits_screen.dart';
import '../../features/placeholders/invalid_link_screen.dart';
import '../../features/publish/presentation/publish_wizard_screen.dart';
import '../../features/shell/app_shell.dart';
import '../../features/splash/splash_screen.dart';
import '../config/app_config.dart';
import 'app_routes.dart';
import 'deep_link_resolver.dart';

GoRouter createRouter(
  AppConfig config, {
  String initialLocation = AppRoutes.splash,
  GlobalKey<NavigatorState>? navigatorKey,
}) {
  final rootKey = navigatorKey ?? GlobalKey<NavigatorState>();
  final deepLinks = DeepLinkResolver(
    allowedHttpsHosts: {
      if (config.publicWebHost != null) config.publicWebHost!,
    },
  );

  return GoRouter(
    navigatorKey: rootKey,
    initialLocation: initialLocation,
    redirect: (context, state) {
      final location = state.matchedLocation;
      if (!config.isConfigured) {
        return location == AppRoutes.configMissing
            ? null
            : AppRoutes.configMissing;
      }
      if (location == AppRoutes.configMissing) {
        return AppRoutes.splash;
      }
      return deepLinks.redirect(state.uri);
    },
    errorBuilder: (context, state) {
      return Scaffold(
        appBar: AppBar(title: const Text('Page introuvable')),
        body: const AppEmptyState(
          icon: Icons.link_off,
          title: 'Page introuvable',
          message: 'Cette adresse n\'existe pas dans l\'application.',
        ),
      );
    },
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.configMissing,
        builder: (context, state) => const MissingConfigScreen(),
      ),
      GoRoute(
        path: AppRoutes.login,
        parentNavigatorKey: rootKey,
        builder: (context, state) =>
            LoginScreen(next: state.uri.queryParameters[AppRoutes.nextQuery]),
      ),
      GoRoute(
        path: AppRoutes.register,
        parentNavigatorKey: rootKey,
        builder: (context, state) => RegisterScreen(
          next: state.uri.queryParameters[AppRoutes.nextQuery],
        ),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        parentNavigatorKey: rootKey,
        builder: (context, state) => ResetPasswordScreen(
          initialToken: state.uri.queryParameters['token'],
        ),
      ),
      GoRoute(
        path: AppRoutes.verifyContact,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const VerifyContactScreen(),
      ),
      GoRoute(
        path: AppRoutes.editProfile,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const EditProfileScreen(),
      ),
      GoRoute(
        path: AppRoutes.housingPreferences,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const HousingPreferencesScreen(),
      ),
      GoRoute(
        path: AppRoutes.savedSearches,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const SavedSearchesScreen(),
        routes: [
          GoRoute(
            path: ':${AppRoutes.savedSearchParam}',
            parentNavigatorKey: rootKey,
            builder: (context, state) {
              final id = state.pathParameters[AppRoutes.savedSearchParam] ?? '';
              return SavedSearchEditScreen(savedSearchId: id);
            },
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.accountSecurity,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const AccountSecurityScreen(),
      ),
      GoRoute(
        path: AppRoutes.changePassword,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.accountSessions,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const AccountSessionsScreen(),
      ),
      GoRoute(
        path: AppRoutes.notificationPreferences,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const NotificationPreferencesScreen(),
      ),
      GoRoute(
        path: AppRoutes.accountPrivacy,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const AccountPrivacyScreen(),
      ),
      GoRoute(
        path: AppRoutes.messages,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const ConversationsScreen(),
      ),
      GoRoute(
        path: AppRoutes.visitTour,
        parentNavigatorKey: rootKey,
        builder: (context, state) {
          final raw = state.uri.queryParameters['ids'];
          final ids = raw == null || raw.isEmpty
              ? const <String>[]
              : raw.split(',');
          return VisitTourScreen(initialVisitIds: ids);
        },
      ),
      GoRoute(
        path: AppRoutes.visits,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const VisitsScreen(),
      ),
      GoRoute(
        path: AppRoutes.pro,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const ProDashboardScreen(),
        routes: [
          GoRoute(
            path: 'listings',
            parentNavigatorKey: rootKey,
            builder: (context, state) => const ProListingsScreen(),
          ),
          GoRoute(
            path: 'leads',
            parentNavigatorKey: rootKey,
            builder: (context, state) => const ProLeadsScreen(),
            routes: [
              GoRoute(
                path: ':${AppRoutes.inquiryParam}',
                parentNavigatorKey: rootKey,
                builder: (context, state) {
                  final id = state.pathParameters[AppRoutes.inquiryParam] ?? '';
                  return ProLeadDetailScreen(inquiryId: id);
                },
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.compare,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const CompareScreen(),
      ),
      GoRoute(
        path: AppRoutes.assistant,
        parentNavigatorKey: rootKey,
        builder: (context, state) {
          return AssistantScreen(initialQuery: state.uri.queryParameters['q']);
        },
      ),
      GoRoute(
        path: AppRoutes.exploreFilters,
        parentNavigatorKey: rootKey,
        builder: (context, state) {
          return ExploreFiltersScreen(
            query: ExploreQuery.fromUri(state.uri),
            savedSearchId:
                state.uri.queryParameters[AppRoutes.savedSearchIdQuery],
          );
        },
      ),
      GoRoute(
        path: AppRoutes.publish,
        parentNavigatorKey: rootKey,
        builder: (context, state) => PublishWizardScreen(
          listingId: state.uri.queryParameters[AppRoutes.listingIdQuery],
        ),
      ),
      GoRoute(
        path: AppRoutes.invalidLink,
        parentNavigatorKey: rootKey,
        builder: (context, state) => const InvalidLinkScreen(),
      ),
      GoRoute(
        path: '/conversations/:${AppRoutes.conversationParam}',
        parentNavigatorKey: rootKey,
        builder: (context, state) {
          final id = state.pathParameters[AppRoutes.conversationParam] ?? '';
          return ConversationThreadScreen(conversationId: id);
        },
      ),
      GoRoute(
        path: '/appointments/:${AppRoutes.appointmentParam}',
        parentNavigatorKey: rootKey,
        builder: (context, state) {
          final id = state.pathParameters[AppRoutes.appointmentParam] ?? '';
          return VisitDetailScreen(appointmentId: id);
        },
      ),
      GoRoute(
        path: '/listings/:${AppRoutes.listingParam}',
        parentNavigatorKey: rootKey,
        builder: (context, state) {
          final id = state.pathParameters[AppRoutes.listingParam] ?? '';
          return ListingDetailScreen(listingId: id);
        },
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.explore,
                builder: (context, state) {
                  return ExploreScreen(query: ExploreQuery.fromUri(state.uri));
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.favorites,
                builder: (context, state) => const FavoritesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.notifications,
                builder: (context, state) => const NotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.account,
                builder: (context, state) => const AccountScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

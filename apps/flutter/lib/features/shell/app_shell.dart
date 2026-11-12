import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../notifications/presentation/inbox_providers.dart';
import '../offline/offline_banner.dart';

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(inboxControllerProvider).value?.unread ?? 0;
    return Scaffold(
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(child: navigationShell),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        onDestinationSelected: (index) {
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Accueil',
          ),
          const NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore),
            label: 'Explorer',
          ),
          const NavigationDestination(
            icon: Icon(Icons.favorite_border),
            selectedIcon: Icon(Icons.favorite),
            label: 'Favoris',
          ),
          NavigationDestination(
            icon: _UnreadIcon(unread: unread, selected: false),
            selectedIcon: _UnreadIcon(unread: unread, selected: true),
            label: 'Notifs',
            tooltip: 'Notifications',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Compte',
          ),
        ],
      ),
    );
  }
}

class _UnreadIcon extends StatelessWidget {
  const _UnreadIcon({required this.unread, required this.selected});

  final int unread;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final icon = Icon(
      selected ? Icons.notifications : Icons.notifications_none_outlined,
    );
    if (unread <= 0) {
      return icon;
    }
    return Badge(label: Text(unread > 99 ? '99+' : '$unread'), child: icon);
  }
}

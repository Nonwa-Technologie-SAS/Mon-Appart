import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const screenPrivacyCoverKey = ValueKey<String>('screen-privacy-cover');

typedef ScreenPrivacySync = Future<void> Function(bool secure);

/// Nombre d'écrans sensibles ouverts. Android reçoit `FLAG_SECURE` en parallèle.
class ScreenPrivacy extends Notifier<int> {
  static const channelName = 'ci.monappart/screen_privacy';

  @override
  int build() => 0;

  bool get active => ref.mounted && state > 0;

  void acquire() {
    if (!ref.mounted) {
      return;
    }
    state = state + 1;
    _push();
  }

  void release() {
    if (!ref.mounted || state == 0) {
      return;
    }
    state = state - 1;
    _push();
  }

  void _push() {
    if (!ref.mounted) {
      return;
    }
    final sync = ref.read(screenPrivacySyncProvider);
    sync(active).catchError((Object _) {});
  }
}

final screenPrivacyProvider = NotifierProvider<ScreenPrivacy, int>(
  ScreenPrivacy.new,
);

final screenPrivacySyncProvider = Provider<ScreenPrivacySync>((ref) {
  return _defaultSync;
});

Future<void> _defaultSync(bool secure) async {
  try {
    await const MethodChannel(
      ScreenPrivacy.channelName,
    ).invokeMethod<void>('setSecure', secure);
  } on MissingPluginException {
    // iOS et les tests : le voile Flutter couvre l'aperçu.
  } on PlatformException {
    // Un échec natif ne doit pas interrompre l'écran.
  }
}

/// Active le masquage après la frame, pour ne pas modifier Riverpod en plein build.
class SensitiveScreenBinding {
  ScreenPrivacy? _privacy;
  var _generation = 0;
  var _held = false;

  void attach(WidgetRef ref) {
    final generation = ++_generation;
    _privacy = ref.read(screenPrivacyProvider.notifier);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (generation != _generation) {
        return;
      }
      _held = true;
      _privacy?.acquire();
    });
  }

  void detach() {
    _generation += 1;
    final privacy = _privacy;
    final held = _held;
    _held = false;
    _privacy = null;
    if (!held || privacy == null) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      privacy.release();
    });
  }
}

/// Marque un écran dont l'aperçu système ne doit pas montrer le contenu.
class SensitiveSurface extends ConsumerStatefulWidget {
  const SensitiveSurface({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<SensitiveSurface> createState() => _SensitiveSurfaceState();
}

class _SensitiveSurfaceState extends ConsumerState<SensitiveSurface> {
  final _binding = SensitiveScreenBinding();

  @override
  void initState() {
    super.initState();
    _binding.attach(ref);
  }

  @override
  void dispose() {
    _binding.detach();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Voile opaque quand un écran sensible passe en arrière-plan.
class ScreenPrivacyOverlay extends ConsumerStatefulWidget {
  const ScreenPrivacyOverlay({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<ScreenPrivacyOverlay> createState() =>
      _ScreenPrivacyOverlayState();
}

class _ScreenPrivacyOverlayState extends ConsumerState<ScreenPrivacyOverlay>
    with WidgetsBindingObserver {
  AppLifecycleState _lifecycle = AppLifecycleState.resumed;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    setState(() => _lifecycle = state);
  }

  @override
  Widget build(BuildContext context) {
    final depth = ref.watch(screenPrivacyProvider);
    final hidden = depth > 0 && _lifecycle != AppLifecycleState.resumed;
    return Stack(
      children: [
        widget.child,
        if (hidden)
          const Positioned.fill(
            key: screenPrivacyCoverKey,
            child: ColoredBox(
              color: Color(0xFF102A22),
              child: Center(
                child: Text(
                  'Mon Appart',
                  style: TextStyle(color: Color(0xFFFFFFFF), fontSize: 20),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

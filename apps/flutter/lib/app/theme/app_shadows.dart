import 'package:flutter/material.dart';

/// Ombres alignées sur `--elevation-*` du site (`docs/ux-ui-design-system.md`).
abstract final class AppShadows {
  static const sm = BoxShadow(
    color: Color(0x0D1A2332),
    offset: Offset(0, 1),
    blurRadius: 2,
  );

  static const md = BoxShadow(
    color: Color(0x121A2332),
    offset: Offset(0, 4),
    blurRadius: 14,
  );

  static const card = <BoxShadow>[sm];
}

import 'package:flutter/material.dart';

/// Rayons alignés sur `--radius: 0.625rem` du site (~10 px).
abstract final class AppRadii {
  static const sm = 6.0;
  static const md = 10.0;
  static const lg = 14.0;
  static const xl = 20.0;

  static const card = BorderRadius.all(Radius.circular(lg));
  static const button = BorderRadius.all(Radius.circular(md));
  static const field = BorderRadius.all(Radius.circular(md));
}

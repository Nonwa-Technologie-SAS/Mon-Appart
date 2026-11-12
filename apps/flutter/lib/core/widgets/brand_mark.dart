import 'package:flutter/material.dart';

/// Logo complet (symbole, nom et signature). Le texte n'est pas redessiné.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.height = 40});

  final double height;

  static const asset = AssetImage('assets/images/logo.png');

  @override
  Widget build(BuildContext context) {
    return Image(
      image: asset,
      height: height,
      fit: BoxFit.contain,
      semanticLabel: 'Mon Appart',
    );
  }
}

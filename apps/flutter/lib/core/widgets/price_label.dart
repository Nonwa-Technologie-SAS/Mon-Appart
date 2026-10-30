import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';
import '../listing/money_format.dart';

class PriceLabel extends StatelessWidget {
  const PriceLabel({super.key, required this.price, this.compact = false});

  final ListingPrice? price;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style =
        (compact ? theme.textTheme.titleSmall : theme.textTheme.titleMedium)
            ?.copyWith(fontWeight: FontWeight.w700, color: AppColors.primary);
    return Text(MoneyFormat.formatPrice(price), style: style);
  }
}

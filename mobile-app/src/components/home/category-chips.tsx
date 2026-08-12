import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

type CategoryChipsProps = {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
};

export function CategoryChips({ options, selected, onSelect }: CategoryChipsProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {options.map((option) => {
        const isActive = option.value === selected;
        return (
          <Pressable
            key={option.value || 'all'}
            onPress={() => onSelect(option.value)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? theme.primary : theme.backgroundElement,
                borderColor: isActive ? theme.primary : theme.border,
              },
            ]}>
            <Text
              style={[
                styles.chipText,
                { color: isActive ? theme.primaryForeground : theme.text },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { tokens } from '../theme';

interface InputAreaProps extends TextInputProps {
  style?: ViewStyle;
}

export const InputArea: React.FC<InputAreaProps> = ({ style, ...rest }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, isFocused && styles.containerFocused, style]}>
      <TextInput
        style={styles.input}
        placeholderTextColor={tokens.colors.textMuted}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...rest}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.medium,
    padding: tokens.spacing.s,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 120,
  },
  containerFocused: {
    borderColor: tokens.colors.divider,
  },
  input: {
    flex: 1,
    fontFamily: undefined, // Let RN handle default system font
    fontSize: tokens.typography.body.fontSize,
    fontWeight: tokens.typography.body.fontWeight as any,
    color: tokens.colors.textPrimary,
    lineHeight: tokens.typography.body.lineHeight,
    textAlignVertical: 'top',
  },
});

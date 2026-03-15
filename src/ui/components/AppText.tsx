import React from 'react';
import { Text, TextProps } from 'react-native';
import { tokens } from '../theme';

export type AppTextVariant = 'title' | 'body' | 'meta' | 'numeric';
export type AppTextTone = 'primary' | 'muted' | 'danger' | 'inverse' | 'accent';

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  tone?: AppTextTone;
  children: React.ReactNode;
}

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  tone = 'primary',
  style,
  children,
  ...rest
}) => {
  const baseStyle = tokens.typography[variant] as any;

  let color = baseStyle.color;
  if (tone === 'primary') color = tokens.colors.textPrimary;
  else if (tone === 'muted') color = tokens.colors.textMuted;
  else if (tone === 'danger') color = tokens.colors.danger;
  else if (tone === 'inverse') color = tokens.colors.inverse;
  else if (tone === 'accent') color = tokens.colors.accent;

  return (
    <Text style={[baseStyle, { color }, style]} {...rest}>
      {children}
    </Text>
  );
};

import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../theme';

interface IconButtonProps {
    icon: keyof typeof Ionicons.glyphMap;
    onPress?: () => void;
    disabled?: boolean;
    active?: boolean;
    style?: ViewStyle;
    isPulsing?: boolean;
    color?: string;
    size?: number;
}

export const IconButton: React.FC<IconButtonProps> = ({
    icon,
    onPress,
    disabled = false,
    active = false,
    style,
    isPulsing = false,
    color,
    size = 24
}) => {
    const defaultIconColor = disabled ? tokens.colors.divider : (active ? tokens.colors.accent : tokens.colors.textMuted);
    const finalIconColor = color || defaultIconColor;

    return (
        <TouchableOpacity
            activeOpacity={0.6}
            style={[
                styles.button,
                active && styles.buttonActive,
                disabled && styles.buttonDisabled,
                style
            ]}
            onPress={onPress}
            disabled={disabled}
        >
            {/* Simulation for pulse - just for sizing container correctly */}
            <View style={[styles.iconContainer, isPulsing && styles.pulseContainer]}>
                <Ionicons name={icon} size={size} color={finalIconColor} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: tokens.radius.medium,
    },
    buttonActive: {
        backgroundColor: tokens.colors.surface,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseContainer: {
        padding: 12,
        backgroundColor: tokens.colors.surface, // Or substitute true pulsing animation layer
        borderRadius: 40,
        borderWidth: 1,
        borderColor: tokens.colors.divider
    }
});

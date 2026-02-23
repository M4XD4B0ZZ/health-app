import React from 'react';
import { StyleSheet, ViewStyle, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../theme';

interface ScreenContainerProps {
    children: React.ReactNode;
    scroll?: boolean;
    style?: ViewStyle;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
    children,
    scroll = false,
    style
}) => {
    const Container = scroll ? ScrollView : View;

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
            <Container
                style={[styles.container, style]}
                contentContainerStyle={scroll ? styles.scrollContent : undefined}
            >
                {children}
            </Container>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: tokens.colors.background,
    },
    container: {
        flex: 1,
        paddingHorizontal: tokens.spacing.m,
    },
    scrollContent: {
        flexGrow: 1,
        paddingTop: tokens.spacing.m,
        paddingBottom: tokens.spacing.xl,
    }
});

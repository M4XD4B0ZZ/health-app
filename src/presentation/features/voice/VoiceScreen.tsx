import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { tokens } from '../../../ui/theme';
import { ScreenContainer } from '../../../ui/components/ScreenContainer';
import { AppText } from '../../../ui/components/AppText';
import { IconButton } from '../../../ui/components/IconButton';
import { InlineStatus, InlineStatusState } from '../../../ui/components/InlineStatus';
import { SummaryBar, MacroStack } from '../../../ui/components/SummaryBar';

export const VoiceScreen: React.FC = () => {
    const navigation = useNavigation();
    const [transcribedText, setTranscribedText] = useState<string>('');
    const [status, setStatus] = useState<InlineStatusState>('idle');
    const [statusMessage, setStatusMessage] = useState<string>('');

    // Dummy listening progression for MVP testing
    useEffect(() => {
        let timeout1: NodeJS.Timeout, timeout2: NodeJS.Timeout, timeout3: NodeJS.Timeout;

        timeout1 = setTimeout(() => {
            setTranscribedText('"I had two scrambled eggs and a slice of toast..."');
        }, 1500);

        return () => {
            clearTimeout(timeout1);
        };
    }, []);

    const handleFinishListening = () => {
        setStatus('processing');
        setStatusMessage('Analyzing your meal...');

        // Dummy processing delay
        setTimeout(() => {
            setStatus('done');
            setStatusMessage('Added to journal.');
            setTimeout(() => navigation.goBack(), 1500);
        }, 2000);
    };

    const handleCancel = () => {
        navigation.goBack();
    };

    return (
        <ScreenContainer>
            {/* Header consistent with LOG */}
            <View style={styles.header}>
                <AppText variant="title">Listening</AppText>
            </View>

            {/* Dominant input area equivalent - actively transcribing */}
            <View style={styles.transcriptBox}>
                <AppText
                    variant="body"
                    tone={transcribedText ? 'primary' : 'muted'}
                >
                    {transcribedText || 'Listening for your meal...'}
                </AppText>
            </View>

            {/* Actions tightly bound to input */}
            <View style={styles.actionsBox}>
                <IconButton
                    icon="close"
                    onPress={handleCancel}
                    disabled={status === 'processing'}
                />
                <IconButton
                    icon="mic"
                    isPulsing={status === 'idle'}
                    active={true}
                    size={32}
                    onPress={handleFinishListening}
                    disabled={status !== 'idle'}
                />
                <View style={{ width: 44 }} /> {/* Spacer for balance */}
            </View>

            {status === 'idle' && (
                <View style={styles.instructionBox}>
                    <AppText variant="meta">Tap mic to finish</AppText>
                </View>
            )}

            {status !== 'idle' && (
                <InlineStatus state={status} message={statusMessage} />
            )}

            <View style={styles.spacer} />

            {/* Shows consistency with the LOG screen, subdued opacity during voice flow */}
            <SummaryBar style={styles.subduedSummary}>
                <View style={styles.summaryLeft}>
                    <AppText variant="meta">Remaining</AppText>
                    <View style={styles.remainingValGroup}>
                        <AppText variant="numeric">1,420</AppText>
                        <AppText variant="meta">kcal</AppText>
                    </View>
                </View>

                <View style={styles.macrosGroup}>
                    <MacroStack label="PRO" value="84g" />
                    <MacroStack label="CARB" value="120g" />
                    <MacroStack label="FAT" value="45g" />
                </View>
            </SummaryBar>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    header: {
        paddingTop: tokens.spacing.m,
        paddingBottom: tokens.spacing.s,
    },
    transcriptBox: {
        backgroundColor: tokens.colors.surface,
        borderRadius: tokens.radius.medium,
        padding: tokens.spacing.s,
        minHeight: 120,
    },
    actionsBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: tokens.spacing.xl,
        paddingHorizontal: tokens.spacing.m,
    },
    instructionBox: {
        alignItems: 'center',
        marginTop: tokens.spacing.s,
    },
    spacer: {
        flex: 1,
    },
    subduedSummary: {
        opacity: 0.5,
    },
    summaryLeft: {
        flex: 1,
    },
    remainingValGroup: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: tokens.spacing.xs,
    },
    macrosGroup: {
        flexDirection: 'row',
        gap: tokens.spacing.m,
    }
});

export default VoiceScreen;

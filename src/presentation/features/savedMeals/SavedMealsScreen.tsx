import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import container from '../../../infrastructure/di/container';
import { SavedMealTemplate } from '../../../features/nutrition/domain/models/SavedMealTypes';

// UI Components
import { tokens } from '../../../ui/theme';
import { ScreenContainer } from '../../../ui/components/ScreenContainer';
import { AppText } from '../../../ui/components/AppText';
import { InputArea } from '../../../ui/components/InputArea';
import { IconButton } from '../../../ui/components/IconButton';
import { PrimaryButton } from '../../../ui/components/PrimaryButton';
import { InlineStatus, InlineStatusState } from '../../../ui/components/InlineStatus';
import { templateTotalCalories } from './savedMealsDisplay';

/**
 * SM-005: minimal Saved Meals UI — create a template from today's journal entries, log a
 * template back to today, rename, and delete. Profile-independent per Product Bible
 * Abschnitt 6: shows only factual data (name, item count, an approximate total from the
 * frozen per100g snapshots) — no evaluation/goal information.
 */

const SavedMealsScreen: React.FC = () => {
  const [templates, setTemplates] = useState<SavedMealTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [processingState, setProcessingState] = useState<InlineStatusState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [renamingTemplate, setRenamingTemplate] = useState<SavedMealTemplate | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const loaded = await container.listSavedMealTemplatesUseCase.execute();
      setTemplates(loaded);
    } catch (err) {
      console.error('Failed to load saved meal templates:', err);
    }
  };

  const handleCreateFromToday = async () => {
    const name = newTemplateName.trim();
    if (!name) {
      return;
    }

    setProcessingState('processing');
    setStatusMessage('Vorlage wird erstellt...');
    try {
      const template = await container.createSavedMealFromDateUseCase.execute(today, name);
      if (template.items.length === 0) {
        setProcessingState('error');
        setStatusMessage('Keine heutigen Einträge mit Gramm-Angabe gefunden');
        return;
      }
      setNewTemplateName('');
      setProcessingState('done');
      setStatusMessage('Vorlage gespeichert');
      await loadTemplates();
    } catch (err) {
      console.error('Failed to create saved meal template:', err);
      setProcessingState('error');
      setStatusMessage('Vorlage konnte nicht erstellt werden');
    }
  };

  const handleLogToToday = async (template: SavedMealTemplate) => {
    if (busyTemplateId) return;
    setBusyTemplateId(template.id);
    setProcessingState('processing');
    setStatusMessage(`"${template.name}" wird geloggt...`);
    try {
      await container.logSavedMealToDateUseCase.execute(template.id, today);
      setProcessingState('done');
      setStatusMessage(`"${template.name}" zum heutigen Tag hinzugefügt`);
    } catch (err) {
      console.error('Failed to log saved meal template:', err);
      setProcessingState('error');
      setStatusMessage('Vorlage konnte nicht geloggt werden');
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleDelete = async (template: SavedMealTemplate) => {
    if (busyTemplateId) return;
    setBusyTemplateId(template.id);
    try {
      await container.deleteSavedMealTemplateUseCase.execute(template.id);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to delete saved meal template:', err);
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleOpenRename = (template: SavedMealTemplate) => {
    setRenamingTemplate(template);
    setRenameValue(template.name);
  };

  const handleCloseRename = () => {
    setRenamingTemplate(null);
    setRenameValue('');
  };

  const handleConfirmRename = async () => {
    const name = renameValue.trim();
    if (!renamingTemplate || !name) return;

    try {
      await container.renameSavedMealTemplateUseCase.execute(renamingTemplate.id, name);
      handleCloseRename();
      await loadTemplates();
    } catch (err) {
      console.error('Failed to rename saved meal template:', err);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.container}>
        <AppText variant="title" style={styles.title}>
          Gespeicherte Mahlzeiten
        </AppText>

        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Aus heutigen Einträgen speichern</AppText>
          <InputArea
            placeholder="Name der Vorlage"
            value={newTemplateName}
            onChangeText={setNewTemplateName}
            style={styles.inputArea}
          />
          <PrimaryButton
            label="Vorlage aus heutigen Einträgen erstellen"
            onPress={handleCreateFromToday}
            disabled={processingState === 'processing' || !newTemplateName.trim()}
            style={styles.createButton}
          />
        </View>

        <InlineStatus state={processingState} message={statusMessage} />

        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Vorlagen</AppText>
          {templates.length === 0 ? (
            <AppText tone="muted">Noch keine gespeicherten Mahlzeiten.</AppText>
          ) : (
            templates.map((template) => {
              const totalCalories = templateTotalCalories(template);
              const isBusy = busyTemplateId === template.id;

              return (
                <View key={template.id} style={styles.templateRow}>
                  <View style={styles.templateInfo}>
                    <AppText variant="body">{template.name}</AppText>
                    <AppText variant="meta" tone="muted">
                      {template.items.length} Zutat{template.items.length === 1 ? '' : 'en'}
                      {totalCalories !== null ? ` · ~${Math.round(totalCalories)} kcal` : ''}
                    </AppText>
                  </View>
                  <View style={styles.templateActions}>
                    <PrimaryButton
                      label="Loggen"
                      onPress={() => handleLogToToday(template)}
                      disabled={isBusy}
                      style={styles.templateActionButton}
                    />
                    <IconButton
                      icon="pencil"
                      onPress={() => handleOpenRename(template)}
                      disabled={isBusy}
                    />
                    <IconButton
                      icon="trash"
                      onPress={() => handleDelete(template)}
                      disabled={isBusy}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      <Modal visible={renamingTemplate !== null} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <AppText style={styles.modalTitle}>Vorlage umbenennen</AppText>
            <InputArea
              placeholder="Name der Vorlage"
              value={renameValue}
              onChangeText={setRenameValue}
              style={styles.inputArea}
            />
            <PrimaryButton label="Speichern" onPress={handleConfirmRename} />
            <IconButton icon="close" onPress={handleCloseRename} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: tokens.colors.background,
  },
  title: {
    marginBottom: tokens.spacing.m,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
  },
  inputArea: {
    borderRadius: tokens.radius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.divider,
    padding: tokens.spacing.s,
    fontSize: 16,
  },
  createButton: {
    marginTop: tokens.spacing.s,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.divider,
  },
  templateInfo: {
    flex: 1,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  templateActionButton: {
    minHeight: 36,
    paddingVertical: tokens.spacing.xs,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: tokens.colors.surface,
    padding: 20,
    borderRadius: tokens.radius.medium,
    width: '80%',
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 12,
  },
});

export default SavedMealsScreen;

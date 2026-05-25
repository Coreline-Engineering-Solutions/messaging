import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { MessagingPanelContent } from './MessagingPanelContent';

/** Full-screen messaging UI for a dedicated host tab (not a bottom sheet). */
export function MessagingScreen() {
  return (
    <View style={styles.root}>
      <MessagingPanelContent />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

import React from 'react';
import { View } from 'react-native';
import { messagingStyles } from '../styles/messagingStyles';
import { MessagingPanel } from './MessagingPanel';

export function MessagingOverlay({ panelBottomInset }: { panelBottomInset: number }) {
  return (
    <View style={messagingStyles.overlayRoot} pointerEvents="box-none">
      <MessagingPanel bottomInset={panelBottomInset} />
    </View>
  );
}

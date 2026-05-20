import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable } from 'react-native';
import { useMessaging } from '../context/MessagingContext';

export type MapTabBarButtonProps = BottomTabBarButtonProps & {
  onNavigateToHost?: () => void;
};

/** Map (or host) tab: dismiss messenger when returning. */
export function MapTabBarButton({ onNavigateToHost, ...props }: MapTabBarButtonProps) {
  const { closePanel, panelOpen } = useMessaging();

  return (
    <Pressable
      accessibilityRole={props.accessibilityRole}
      accessibilityState={props.accessibilityState}
      accessibilityLabel={props.accessibilityLabel}
      testID={props.testID}
      onPress={(e) => {
        if (panelOpen) closePanel();
        onNavigateToHost?.();
        props.onPress?.(e);
      }}
      style={props.style}
    >
      {props.children}
    </Pressable>
  );
}

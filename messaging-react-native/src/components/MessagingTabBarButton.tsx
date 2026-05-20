import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMessaging } from '../context/MessagingContext';
import { messagingStyles } from '../styles/messagingStyles';

export type MessagingTabBarButtonProps = BottomTabBarButtonProps & {
  /** Host navigates to the screen that hosts MessagingOverlay (e.g. map tab). */
  onNavigateToHost: () => void;
};

/** Messages tab: open host screen + messenger panel. */
export function MessagingTabBarButton({
  onNavigateToHost,
  ...props
}: MessagingTabBarButtonProps) {
  const { openPanel, totalUnread } = useMessaging();

  return (
    <Pressable
      accessibilityRole={props.accessibilityRole}
      accessibilityState={props.accessibilityState}
      accessibilityLabel={props.accessibilityLabel}
      testID={props.testID}
      onPress={(e) => {
        onNavigateToHost();
        openPanel();
        props.onPress?.(e);
      }}
      style={props.style}
    >
      <View>
        {props.children}
        {totalUnread > 0 && (
          <View style={messagingStyles.tabUnreadBadge} pointerEvents="none">
            <Text style={messagingStyles.tabUnreadText}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

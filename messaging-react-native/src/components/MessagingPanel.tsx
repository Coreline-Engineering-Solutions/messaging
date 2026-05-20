import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, View, useWindowDimensions } from 'react-native';
import { useMessaging } from '../context/MessagingContext';
import {
  MESSAGING_PANEL_HEIGHT_MAX,
  MESSAGING_PANEL_HEIGHT_MIN,
} from '../constants/messagingConfig';
import { messagingStyles } from '../styles/messagingStyles';
import { MessagingChatThread } from './MessagingChatThread';
import { MessagingGroupManager } from './MessagingGroupManager';
import { MessagingInboxList } from './MessagingInboxList';
import { MessagingMessageSearch } from './MessagingMessageSearch';
import { MessagingNewConversation } from './MessagingNewConversation';
import { MessagingThreadViewer } from './MessagingThreadViewer';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function MessagingPanel({ bottomInset }: { bottomInset: number }) {
  const { height: screenH } = useWindowDimensions();
  const { panelOpen, panelHeightRatio, setPanelHeightRatio, activeView } = useMessaging();

  const maxH = screenH * MESSAGING_PANEL_HEIGHT_MAX;
  const minH = screenH * MESSAGING_PANEL_HEIGHT_MIN;
  const targetH = clamp(screenH * panelHeightRatio, minH, maxH);

  const [displayHeight, setDisplayHeight] = useState(targetH);
  const displayHeightRef = useRef(targetH);
  const startHeightRef = useRef(targetH);
  const isDraggingRef = useRef(false);
  displayHeightRef.current = displayHeight;

  useEffect(() => {
    if (!isDraggingRef.current) {
      setDisplayHeight(targetH);
      startHeightRef.current = targetH;
      displayHeightRef.current = targetH;
    }
  }, [targetH]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        startHeightRef.current = displayHeightRef.current;
      },
      onPanResponderMove: (_, g) => {
        const next = clamp(startHeightRef.current - g.dy, minH, maxH);
        setDisplayHeight(next);
      },
      onPanResponderRelease: (_, g) => {
        const next = clamp(startHeightRef.current - g.dy, minH, maxH);
        isDraggingRef.current = false;
        setDisplayHeight(next);
        startHeightRef.current = next;
        void setPanelHeightRatio(next / screenH);
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
      },
    })
  ).current;

  if (!panelOpen) return null;

  return (
    <View
      style={[
        messagingStyles.panelOuter,
        { height: displayHeight, bottom: bottomInset },
      ]}
    >
      <View {...panResponder.panHandlers} style={messagingStyles.resizeHandle}>
        <View style={messagingStyles.resizeGrab} />
      </View>

      <View style={messagingStyles.panelBody}>
        {activeView === 'inbox' && <MessagingInboxList />}
        {activeView === 'chat' && <MessagingChatThread />}
        {activeView === 'new-conversation' && <MessagingNewConversation />}
        {activeView === 'group-manager' && <MessagingGroupManager />}
        {activeView === 'message-search' && <MessagingMessageSearch />}
        {activeView === 'thread' && <MessagingThreadViewer />}
      </View>
    </View>
  );
}

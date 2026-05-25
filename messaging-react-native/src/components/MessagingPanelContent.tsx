import React from 'react';
import { View } from 'react-native';
import { useMessaging } from '../context/MessagingContext';
import { messagingStyles } from '../styles/messagingStyles';
import { MessagingChatThread } from './MessagingChatThread';
import { MessagingGroupManager } from './MessagingGroupManager';
import { MessagingInboxList } from './MessagingInboxList';
import { MessagingMessageSearch } from './MessagingMessageSearch';
import { MessagingNewConversation } from './MessagingNewConversation';
import { MessagingThreadViewer } from './MessagingThreadViewer';

/** Shared inbox / chat / group views for overlay panel and full-screen tab. */
export function MessagingPanelContent() {
  const { activeView } = useMessaging();

  return (
    <View style={messagingStyles.panelBody}>
      {activeView === 'inbox' && <MessagingInboxList />}
      {activeView === 'chat' && <MessagingChatThread />}
      {activeView === 'new-conversation' && <MessagingNewConversation />}
      {activeView === 'group-manager' && <MessagingGroupManager />}
      {activeView === 'message-search' && <MessagingMessageSearch />}
      {activeView === 'thread' && <MessagingThreadViewer />}
    </View>
  );
}

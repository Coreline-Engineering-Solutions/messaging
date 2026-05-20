import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../theme';
import { useMessaging } from '../context/MessagingContext';
import { messagingStyles } from '../styles/messagingStyles';
import type { Message } from '../types/messaging';
import { resolveMessageSenderDisplayName } from '../types/messaging';

export function MessagingThreadViewer() {
  const {
    threadParent,
    threadMessages,
    closeThread,
    sendThreadMessage,
    contact,
    visibleContacts,
  } = useMessaging();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  if (!threadParent) {
    return (
      <View style={messagingStyles.emptyState}>
        <Text style={messagingStyles.emptyText}>No thread selected</Text>
      </View>
    );
  }

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendThreadMessage(draft);
      setDraft('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={messagingStyles.chatHeader}>
        <TouchableOpacity style={messagingStyles.iconButton} onPress={closeThread}>
          <MaterialIcons name="arrow-back" size={16} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={[messagingStyles.convName, { flex: 1 }]} numberOfLines={1}>
          Thread
        </Text>
      </View>

      <View style={{ padding: 12, backgroundColor: colors.glassUltra }}>
        <Text style={messagingStyles.convPreview} numberOfLines={3}>
          {threadParent.content || '[Media]'}
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={threadMessages}
        keyExtractor={(item) => item.message_id}
        contentContainerStyle={messagingStyles.messagesList}
        renderItem={({ item }) => {
          const own = String(item.sender_id) === String(contact?.contact_id);
          return (
            <View style={own ? messagingStyles.bubbleRowOwn : messagingStyles.bubbleRowOther}>
              {!own && (
                <Text style={messagingStyles.senderName}>
                  {resolveMessageSenderDisplayName(item, visibleContacts, contact?.contact_id)}
                </Text>
              )}
              <View style={own ? messagingStyles.bubbleOwn : messagingStyles.bubbleOther}>
                <Text style={messagingStyles.bubbleText}>{item.content}</Text>
              </View>
            </View>
          );
        }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={messagingStyles.inputBar}>
        <TextInput
          style={messagingStyles.textInput}
          placeholder="Reply in threadâ€¦"
          placeholderTextColor={colors.text.tertiary}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity
          style={[messagingStyles.sendBtn, sending && { opacity: 0.5 }]}
          onPress={() => void handleSend()}
          disabled={sending}
        >
          <MaterialIcons name="send" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../theme';
import { useMessaging } from '../context/MessagingContext';
import { messagingStyles } from '../styles/messagingStyles';
import type { Message } from '../types/messaging';
import { formatMessageTime } from '../utils/messagingHelpers';

export function MessagingMessageSearch() {
  const { searchMessages, goBackToInbox, openConversation, inbox, activeConversationId } =
    useMessaging();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      setResults(await searchMessages(query));
    } finally {
      setLoading(false);
    }
  };

  const openResult = (msg: Message) => {
    const item = inbox.find((i) => i.conversation_id === msg.conversation_id);
    if (item) openConversation(item);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={messagingStyles.chatHeader}>
        <TouchableOpacity style={messagingStyles.iconButton} onPress={goBackToInbox}>
          <MaterialIcons name="arrow-back" size={16} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={[messagingStyles.convName, { flex: 1 }]}>
          {activeConversationId ? 'Search in chat' : 'Search messages'}
        </Text>
      </View>

      <View style={messagingStyles.groupSearchBar}>
        <MaterialIcons name="search" size={20} color={colors.text.tertiary} />
        <TextInput
          style={messagingStyles.searchInput}
          placeholder="Search message text…"
          placeholderTextColor={colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void runSearch()}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => void runSearch()} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          ) : (
            <MaterialIcons name="search" size={22} color={colors.primary[500]} />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.message_id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={messagingStyles.contactRow}
            onPress={() => openResult(item)}
          >
            <View style={{ flex: 1 }}>
              <Text style={messagingStyles.convPreview} numberOfLines={2}>
                {item.content || `[${item.message_type}]`}
              </Text>
              <Text style={messagingStyles.convTime}>
                {formatMessageTime(item.created_at)}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={messagingStyles.emptyState}>
            <Text style={messagingStyles.emptyText}>
              {query ? 'No results' : 'Enter a query to search'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo, useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { useMessaging } from '../context/MessagingContext';
import { messagingStyles } from '../styles/messagingStyles';
import type { Contact } from '../types/messaging';
import { getContactDisplayName } from '../types/messaging';

export function MessagingNewConversation() {
  const { visibleContacts, openDirectConversation, setView, contact } = useMessaging();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleContacts.filter((c) => {
      if (c.contact_id === contact?.contact_id) return false;
      if (!q) return true;
      const name = getContactDisplayName(c).toLowerCase();
      return name.includes(q) || c.email.toLowerCase().includes(q);
    });
  }, [visibleContacts, search, contact]);

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={messagingStyles.contactRow}
      onPress={() => openDirectConversation(item)}
    >
      <View style={messagingStyles.avatar}>
        <MaterialIcons name="person" size={22} color={colors.text.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={messagingStyles.convName}>{getContactDisplayName(item)}</Text>
        <Text style={messagingStyles.convPreview}>{item.email}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={messagingStyles.chatHeader}>
        <TouchableOpacity
          style={messagingStyles.iconButton}
          onPress={() => setView('inbox')}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={16} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={messagingStyles.inboxTitle}>New conversation</Text>
      </View>
      <View style={messagingStyles.searchBar}>
        <MaterialIcons name="search" size={20} color={colors.text.tertiary} />
        <TextInput
          style={messagingStyles.searchInput}
          placeholder="Search contactsâ€¦"
          placeholderTextColor={colors.text.tertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.contact_id}
        renderItem={renderContact}
        ListEmptyComponent={
          <View style={messagingStyles.emptyState}>
            <Text style={messagingStyles.emptyText}>No contacts found</Text>
          </View>
        }
      />
    </View>
  );
}

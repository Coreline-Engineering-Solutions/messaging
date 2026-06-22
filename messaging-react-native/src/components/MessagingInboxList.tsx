import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, spacing } from '../theme';
import { useMessaging } from '../context/MessagingContext';
import { messagingStyles } from '../styles/messagingStyles';
import type { InboxFilter, InboxItem } from '../types/messaging';
import { getInboxDisplayName, isProjectConversation } from '../types/messaging';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const FILTER_EMPTY_LABEL: Record<InboxFilter, string> = {
  all: 'conversations',
  dms: 'DM conversations',
  groups: 'group conversations',
  favorites: 'favorite conversations',
  projects: 'project conversations',
};

export function MessagingInboxList() {
  const {
    inbox,
    openConversation,
    setView,
    isReady,
    initError,
    refreshInbox,
    visibleContacts,
    openCreateGroup,
    openMessageSearch,
    isFavoriteConversation,
    toggleFavoriteConversation,
    closePanel,
    presentation,
  } = useMessaging();
  const [search, setSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const list = inbox.filter((item) => {
      if (inboxFilter === 'projects') return isProjectConversation(item);
      if (inboxFilter === 'groups') return !!item.is_group && !isProjectConversation(item);
      if (inboxFilter === 'dms') return !item.is_group;
      if (inboxFilter === 'favorites') return isFavoriteConversation(item.conversation_id);
      return true;
    });

    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        getInboxDisplayName(i, visibleContacts).toLowerCase().includes(q) ||
        (i.last_message_preview || '').toLowerCase().includes(q)
    );
  }, [inbox, search, inboxFilter, visibleContacts, isFavoriteConversation]);

  if (initError) {
    return (
      <View style={messagingStyles.emptyState}>
        <MaterialIcons name="error-outline" size={40} color={colors.error} />
        <Text style={messagingStyles.emptyText}>{initError}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={messagingStyles.emptyState}>
        <ActivityIndicator color={colors.primary[500]} />
        <Text style={messagingStyles.emptyText}>Loading messenger…</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: InboxItem }) => {
    const favorited = isFavoriteConversation(item.conversation_id);

    return (
      <View style={messagingStyles.convItem}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
          onPress={() => openConversation(item)}
          activeOpacity={0.7}
        >
          <View style={messagingStyles.avatar}>
            <MaterialIcons
              name={item.is_group ? 'group' : 'person'}
              size={22}
              color={colors.text.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={messagingStyles.convName} numberOfLines={1}>
                {getInboxDisplayName(item, visibleContacts)}
              </Text>
              <Text style={messagingStyles.convTime}>{formatTime(item.last_message_at)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={messagingStyles.convPreview} numberOfLines={1}>
                {item.last_message_preview || 'No messages yet'}
              </Text>
              {item.unread_count > 0 && (
                <View style={messagingStyles.unreadBadge}>
                  <Text style={messagingStyles.unreadText}>
                    {item.unread_count > 99 ? '99+' : item.unread_count}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={messagingStyles.convFavoriteButton}
          onPress={() => void toggleFavoriteConversation(item.conversation_id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={favorited ? 'Remove from favorites' : 'Add to favorites'}
          accessibilityRole="button"
        >
          <MaterialIcons
            name={favorited ? 'star' : 'star-outline'}
            size={22}
            color={favorited ? colors.warning : colors.text.tertiary}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const FilterChip = ({
    id,
    label,
  }: {
    id: InboxFilter;
    label: string;
  }) => {
    const active = inboxFilter === id;
    return (
      <TouchableOpacity
        style={[messagingStyles.filterChip, active && messagingStyles.filterChipActive]}
        onPress={() => setInboxFilter(id)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            messagingStyles.filterChipText,
            active && messagingStyles.filterChipTextActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const emptyLabel = search
    ? 'No matching conversations'
    : `No ${FILTER_EMPTY_LABEL[inboxFilter]}`;

  return (
    <View style={{ flex: 1 }}>
      <View style={messagingStyles.inboxHeader}>
        <Text style={messagingStyles.inboxTitle}>Messages</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <TouchableOpacity
            style={messagingStyles.iconButton}
            onPress={() => setView('new-conversation')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="edit" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={messagingStyles.iconButton}
            onPress={openMessageSearch}
            activeOpacity={0.7}
          >
            <MaterialIcons name="search" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={messagingStyles.iconButton}
            onPress={openCreateGroup}
            activeOpacity={0.7}
          >
            <MaterialIcons name="group-add" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
          {presentation === 'overlay' && (
            <TouchableOpacity
              style={messagingStyles.iconButton}
              onPress={closePanel}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityLabel="Close messenger"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={16} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={messagingStyles.inboxFilterRow}>
        <View style={messagingStyles.inboxFilterStrip}>
          <FilterChip id="all" label="All" />
          <FilterChip id="dms" label="DMs" />
          <FilterChip id="groups" label="Groups" />
          <FilterChip id="favorites" label="Favorites" />
          <FilterChip id="projects" label="Projects" />
        </View>
      </View>

      <View style={messagingStyles.searchBar}>
        <MaterialIcons name="search" size={20} color={colors.text.tertiary} />
        <TextInput
          style={messagingStyles.searchInput}
          placeholder="Search conversations…"
          placeholderTextColor={colors.text.tertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.conversation_id}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await refreshInbox();
          setRefreshing(false);
        }}
        ListEmptyComponent={
          <View style={messagingStyles.emptyState}>
            <MaterialIcons
              name={
                inboxFilter === 'favorites'
                  ? 'star-outline'
                  : inboxFilter === 'projects' || inboxFilter === 'groups'
                    ? 'group'
                    : 'forum'
              }
              size={48}
              color={colors.text.tertiary}
            />
            <Text style={messagingStyles.emptyText}>{emptyLabel}</Text>
            {!search && inboxFilter === 'favorites' && (
              <Text style={[messagingStyles.emptyText, { fontSize: 13, marginTop: 4 }]}>
                Tap the star on a conversation to add it here.
              </Text>
            )}
            {!search && (inboxFilter === 'all' || inboxFilter === 'dms') && (
              <TouchableOpacity onPress={() => setView('new-conversation')}>
                <Text style={messagingStyles.linkText}>Start a conversation</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

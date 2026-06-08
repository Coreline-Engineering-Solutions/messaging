import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, spacing } from '../theme';
import { useMessaging } from '../context/MessagingContext';
import { getConversationParticipants } from '../services/messagingApiService';
import { messagingStyles } from '../styles/messagingStyles';
import type { Contact, ConversationParticipant } from '../types/messaging';
import { getContactDisplayName } from '../types/messaging';

export function MessagingGroupManager() {
  const {
    visibleContacts,
    createGroup,
    saveGroupEdit,
    deleteGroup,
    groupEdit,
    contact,
    setView,
    clearGroupEdit,
  } = useMessaging();

  const isEditMode = !!groupEdit;
  const [name, setName] = useState(groupEdit?.name ?? '');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Contact[]>([]);
  const [members, setMembers] = useState<ConversationParticipant[]>([]);
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(new Set());
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(groupEdit?.name ?? '');
    setSelected([]);
    setPendingRemove(new Set());
  }, [groupEdit]);

  const loadMembers = useCallback(async () => {
    if (!groupEdit) return;
    setLoadingMembers(true);
    try {
      const list = await getConversationParticipants(groupEdit.conversationId);
      setMembers(list);
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [groupEdit]);

  useEffect(() => {
    if (isEditMode) void loadMembers();
    else setMembers([]);
  }, [isEditMode, loadMembers]);

  const memberIds = useMemo(
    () =>
      new Set(
        members
          .filter((m) => !pendingRemove.has(m.contact_id))
          .map((m) => m.contact_id)
      ),
    [members, pendingRemove]
  );

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleContacts.filter((c) => {
      if (c.contact_id === contact?.contact_id) return false;
      if (memberIds.has(c.contact_id)) return false;
      if (!q) return true;
      return (
        getContactDisplayName(c).toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [visibleContacts, contact, memberIds, search]);

  const isSelected = (c: Contact) =>
    selected.some((s) => s.contact_id === c.contact_id);

  const removeSelected = (c: Contact) => {
    setSelected((prev) => prev.filter((x) => x.contact_id !== c.contact_id));
  };

  const getMemberLabel = (m: ConversationParticipant) =>
    m.username || m.email || getContactDisplayName(m as Contact);

  const toggleSelect = (c: Contact) => {
    setSelected((prev) =>
      prev.some((x) => x.contact_id === c.contact_id)
        ? prev.filter((x) => x.contact_id !== c.contact_id)
        : [...prev, c]
    );
  };

  const goBack = () => {
    clearGroupEdit();
    setView(isEditMode ? 'chat' : 'inbox');
  };

  const handleSubmit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      if (isEditMode && groupEdit) {
        await saveGroupEdit(
          name.trim(),
          selected.map((c) => c.contact_id),
          Array.from(pendingRemove)
        );
      } else {
        if (selected.length < 1) return;
        await createGroup(
          selected.map((c) => c.contact_id),
          name.trim()
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Leave group', 'Remove yourself from this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => void deleteGroup(),
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={messagingStyles.chatHeader}>
        <TouchableOpacity style={messagingStyles.iconButton} onPress={goBack} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={16} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={messagingStyles.inboxTitle}>
          {isEditMode ? 'Group settings' : 'Create group'}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: '600' }}>
          GROUP NAME
        </Text>
        <TextInput
          style={messagingStyles.textInput}
          placeholder="Enter group name…"
          placeholderTextColor={colors.text.tertiary}
          value={name}
          onChangeText={setName}
        />

        {isEditMode && (
          <>
            <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: '600' }}>
              CURRENT MEMBERS
            </Text>
            {loadingMembers ? (
              <ActivityIndicator color={colors.primary[500]} />
            ) : (
              members.map((m) => {
                const removed = pendingRemove.has(m.contact_id);
                const isYou = m.contact_id === contact?.contact_id;
                return (
                  <View
                    key={m.contact_id}
                    style={[messagingStyles.contactRow, removed && { opacity: 0.4 }]}
                  >
                    <View style={messagingStyles.avatar}>
                      <MaterialIcons name="person" size={20} color={colors.text.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={messagingStyles.convName}>
                        {getMemberLabel(m)}
                        {isYou ? ' (you)' : ''}
                      </Text>
                      {m.email ? (
                        <Text style={messagingStyles.convPreview}>{m.email}</Text>
                      ) : null}
                    </View>
                    {!isYou && !removed && (
                      <TouchableOpacity
                        onPress={() =>
                          setPendingRemove((prev) => new Set(prev).add(m.contact_id))
                        }
                      >
                        <MaterialIcons name="person-remove" size={22} color={colors.error} />
                      </TouchableOpacity>
                    )}
                    {removed && (
                      <TouchableOpacity
                        onPress={() =>
                          setPendingRemove((prev) => {
                            const next = new Set(prev);
                            next.delete(m.contact_id);
                            return next;
                          })
                        }
                      >
                        <Text style={messagingStyles.linkText}>Undo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: '600' }}>
          {isEditMode ? 'ADD MEMBERS' : 'SELECT MEMBERS (min 1)'}
        </Text>
        <View style={messagingStyles.groupSearchBar}>
          <MaterialIcons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={messagingStyles.searchInput}
            placeholder="Search contacts…"
            placeholderTextColor={colors.text.tertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={messagingStyles.memberTagsSection}>
          {selected.length === 0 ? (
            <Text style={messagingStyles.memberTagsHint}>
              Selected people appear here — tap contacts below to add
            </Text>
          ) : (
            <View style={messagingStyles.memberTagsWrap}>
              {selected.map((c) => (
                <View key={c.contact_id} style={messagingStyles.memberTagChip}>
                  <Text style={messagingStyles.memberTagText} numberOfLines={1}>
                    {getContactDisplayName(c)}
                  </Text>
                  <TouchableOpacity
                    style={messagingStyles.memberTagRemove}
                    onPress={() => removeSelected(c)}
                    accessibilityLabel={`Remove ${getContactDisplayName(c)}`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="close" size={14} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {candidates.map((c) => {
          const picked = isSelected(c);
          return (
            <TouchableOpacity
              key={c.contact_id}
              style={[messagingStyles.contactRow, picked && messagingStyles.contactRowSelected]}
              onPress={() => toggleSelect(c)}
              activeOpacity={0.7}
            >
              <View style={messagingStyles.avatar}>
                <MaterialIcons name="person" size={20} color={colors.text.primary} />
              </View>
              <Text style={[messagingStyles.convName, { flex: 1 }]}>
                {getContactDisplayName(c)}
              </Text>
              <MaterialIcons
                name={picked ? 'check-circle' : 'person-add'}
                size={22}
                color={picked ? colors.success : colors.primary[500]}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={messagingStyles.groupActionBar}>
        <TouchableOpacity
          style={messagingStyles.groupPrimaryBtn}
          onPress={() => void handleSubmit()}
          disabled={saving || !name.trim() || (!isEditMode && selected.length < 1)}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={messagingStyles.groupPrimaryBtnText}>
              {isEditMode
                ? 'Confirm changes'
                : `Create group (${selected.length + 1} members)`}
            </Text>
          )}
        </TouchableOpacity>

        {isEditMode && (
          <TouchableOpacity
            style={messagingStyles.groupDeleteBtn}
            onPress={handleDelete}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={messagingStyles.groupDeleteBtnText}>Leave group</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

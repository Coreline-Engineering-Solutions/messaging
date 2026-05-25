import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useRef, useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useMessaging } from '../context/MessagingContext';
import { pickImageFromHost, takePhotoFromHost } from '../services/imagePickerHost';
import { pickImage, pickMultipleImages, takePhoto } from '../services/mediaPickerService';
import { messagingStyles } from '../styles/messagingStyles';
import { colors } from '../theme';
import type { Message } from '../types/messaging';
import { resolveMessageSenderDisplayName } from '../types/messaging';
import {
    formatDateSeparatorLabel,
    formatMessageTime,
    isTempMessageId,
    shouldShowDateSeparator,
} from '../utils/messagingHelpers';
import { MessageImageLightbox } from './MessageImageLightbox';
import { MessageMedia } from './MessageMedia';

const REACTION_EMOJIS = ['ðŸ‘', 'â¤ï¸', 'ðŸ˜‚', 'ðŸ˜®', 'ðŸ˜¢', 'ðŸŽ‰', 'ðŸ”¥', 'ðŸ‘'];

function isMessageRead(msg: Message): boolean {
  if (msg.is_read === true || msg.is_read === 'true' || msg.is_read === '1') return true;
  return false;
}

export function MessagingChatThread() {
  const {
    contact,
    messages,
    activeConversationName,
    activeIsGroup,
    activeConversationId,
    visibleContacts,
    loadingMessages,
    goBackToInbox,
    sendChatMessage,
    sendChatAttachments,
    toggleReaction,
    loadOlderMessages,
    openGroupSettings,
    openMessageSearch,
    openThread,
    editChatMessage,
    deleteChatMessage,
    togglePinMessage,
    closePanel,
    openPanel,
    presentation,
    isFavoriteConversation,
    toggleFavoriteConversation,
    attachmentError,
  } = useMessaging();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ uri: string; fileName: string }[]>([]);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const isOwn = (msg: Message) => String(msg.sender_id) === String(contact?.contact_id);
  const isFavorited = activeConversationId
    ? isFavoriteConversation(activeConversationId)
    : false;

  const handleSend = async () => {
    if (editingId) {
      await editChatMessage(editingId, editDraft);
      setEditingId(null);
      setEditDraft('');
      return;
    }
    if (pendingFiles.length > 0) {
      setSending(true);
      try {
        await sendChatAttachments(pendingFiles, draft.trim());
        setPendingFiles([]);
        setDraft('');
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      } finally {
        setSending(false);
      }
      return;
    }
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendChatMessage(draft);
      setDraft('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  };

  const runImagePick = async (source: 'camera' | 'library' | 'multi') => {
    if (!activeConversationId || pickingImage) return;
    setShowAttachMenu(false);
    setPickingImage(true);
    const panelWasOpen = presentation === 'overlay';
    try {
      if (source === 'camera' && presentation === 'overlay') {
        closePanel();
        await new Promise((r) => setTimeout(r, Platform.OS === 'android' ? 500 : 150));
      }
      if (source === 'multi') {
        const files = await pickMultipleImages(5);
        if (files.length) setPendingFiles((prev) => [...prev, ...files].slice(0, 5));
        return;
      }
      const file =
        source === 'camera'
          ? await takePhotoFromHost().catch(() => takePhoto())
          : await pickImageFromHost().catch(() => pickImage());
      if (file) {
        if (source === 'camera') {
          await sendChatAttachments([file]);
        } else {
          setPendingFiles((prev) => [...prev, file].slice(0, 5));
        }
      }
    } catch (e) {
      console.warn('[MessagingChatThread] image pick failed:', e);
    } finally {
      if (panelWasOpen && source === 'camera') openPanel();
      setPickingImage(false);
    }
  };

  const showMessageActions = (item: Message) => {
    const own = isOwn(item);
    const options: string[] = ['Reply in thread', 'React'];
    const handlers: (() => void)[] = [
      () => void openThread(item),
      () => setReactionTargetId(item.message_id),
    ];

    if (own && item.message_type === 'TEXT' && !isTempMessageId(item.message_id)) {
      options.push('Edit');
      handlers.push(() => {
        setEditingId(item.message_id);
        setEditDraft(item.content || '');
      });
    }
    if (own && !isTempMessageId(item.message_id)) {
      options.push('Delete');
      handlers.push(() => {
        Alert.alert('Delete message', 'Remove this message?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => void deleteChatMessage(item.message_id),
          },
        ]);
      });
    }
    if (!isTempMessageId(item.message_id)) {
      options.push(item.is_pinned ? 'Unpin' : 'Pin');
      handlers.push(() => void togglePinMessage(item));
    }
    options.push('Cancel');
    handlers.push(() => {});

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: options.indexOf('Delete') },
        (idx) => {
          if (idx >= 0 && idx < handlers.length) handlers[idx]();
        }
      );
    } else {
      Alert.alert('Message', undefined, [
        ...options.slice(0, -1).map((label, i) => ({
          text: label,
          style: label === 'Delete' ? ('destructive' as const) : ('default' as const),
          onPress: handlers[i],
        })),
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const renderMessageBody = (item: Message) => {
    if (item.message_type === 'IMAGE' || item.message_type === 'FILE') {
      return (
        <MessageMedia message={item} onPress={(uri) => setLightboxUri(uri)} />
      );
    }
    return <Text style={messagingStyles.bubbleText}>{item.content}</Text>;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const own = isOwn(item);
    const showPicker = reactionTargetId === item.message_id;
    const showDate = shouldShowDateSeparator(messages, index);

    return (
      <View>
        {showDate && (
          <View style={messagingStyles.dateSeparator}>
            <Text style={messagingStyles.dateSeparatorText}>
              {formatDateSeparatorLabel(item.created_at)}
            </Text>
          </View>
        )}
        <View style={own ? messagingStyles.bubbleRowOwn : messagingStyles.bubbleRowOther}>
          {item.is_pinned && (
            <MaterialIcons
              name="push-pin"
              size={12}
              color={colors.text.tertiary}
              style={{ marginBottom: 2 }}
            />
          )}
          {!own && activeIsGroup && (
            <Text style={messagingStyles.senderName}>
              {resolveMessageSenderDisplayName(item, visibleContacts, contact?.contact_id)}
            </Text>
          )}

          {showPicker && (
            <View style={messagingStyles.reactionPicker}>
              {REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={messagingStyles.reactionEmojiBtn}
                  onPress={() => {
                    void toggleReaction(item.message_id, emoji);
                    setReactionTargetId(null);
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => showMessageActions(item)}
            delayLongPress={280}
          >
            <View style={own ? messagingStyles.bubbleOwn : messagingStyles.bubbleOther}>
              {renderMessageBody(item)}
              <View style={messagingStyles.bubbleMetaRow}>
                {item.edited_at && (
                  <Text style={[messagingStyles.editedLabel, own && { color: 'rgba(255,255,255,0.6)' }]}>
                    edited
                  </Text>
                )}
                <Text style={own ? messagingStyles.bubbleTimeOwn : messagingStyles.bubbleTime}>
                  {formatMessageTime(item.created_at)}
                </Text>
                {own && !isTempMessageId(item.message_id) && (
                  <MaterialIcons
                    name={isMessageRead(item) ? 'done-all' : 'done'}
                    size={14}
                    color={isMessageRead(item) ? colors.success : 'rgba(255,255,255,0.55)'}
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>

          {item.reactions && item.reactions.length > 0 && (
            <View style={messagingStyles.reactionRow}>
              {item.reactions.map((r) => (
                <TouchableOpacity
                  key={r.emoji}
                  style={[
                    messagingStyles.reactionChip,
                    r.hasReacted && messagingStyles.reactionChipActive,
                  ]}
                  onPress={() => void toggleReaction(item.message_id, r.emoji)}
                >
                  <Text style={{ fontSize: 13 }}>
                    {r.emoji}
                    {(r.count ?? 0) > 1 ? ` ${r.count}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={messagingStyles.chatHeader}>
        <TouchableOpacity style={messagingStyles.iconButton} onPress={goBackToInbox}>
          <MaterialIcons name="arrow-back" size={16} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={[messagingStyles.convName, { flex: 1 }]} numberOfLines={1}>
          {activeConversationName}
        </Text>
        <TouchableOpacity style={messagingStyles.iconButton} onPress={openMessageSearch}>
          <MaterialIcons name="search" size={16} color={colors.text.secondary} />
        </TouchableOpacity>
        {activeConversationId && (
          <TouchableOpacity
            style={messagingStyles.iconButton}
            onPress={() => void toggleFavoriteConversation(activeConversationId)}
            accessibilityLabel={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <MaterialIcons
              name={isFavorited ? 'star' : 'star-outline'}
              size={16}
              color={isFavorited ? colors.warning : colors.text.secondary}
            />
          </TouchableOpacity>
        )}
        {activeIsGroup && (
          <TouchableOpacity style={messagingStyles.iconButton} onPress={openGroupSettings}>
            <MaterialIcons name="settings" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {loadingMessages && messages.length === 0 ? (
        <View style={messagingStyles.emptyState}>
          <ActivityIndicator color={colors.primary[500]} />
          <Text style={messagingStyles.emptyText}>Loading messagesâ€¦</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.message_id}
          renderItem={renderMessage}
          contentContainerStyle={messagingStyles.messagesList}
          onScrollBeginDrag={() => setReactionTargetId(null)}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            messages.length >= 50 ? (
              <TouchableOpacity
                onPress={() => void loadOlderMessages()}
                style={{ alignSelf: 'center', marginBottom: 8 }}
              >
                <Text style={messagingStyles.linkText}>Load older messages</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={messagingStyles.emptyState}>
              <Text style={messagingStyles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
        />
      )}

      {attachmentError ? (
        <View style={messagingStyles.pendingAttachRow}>
          <Text style={[messagingStyles.emptyText, { color: colors.error }]}>
            {attachmentError}
          </Text>
        </View>
      ) : null}

      {pendingFiles.length > 0 && (
        <View style={messagingStyles.pendingAttachRow}>
          {pendingFiles.map((f, i) => (
            <View key={`${f.uri}-${i}`} style={messagingStyles.pendingAttachChip}>
              <Text style={messagingStyles.convPreview} numberOfLines={1}>
                {f.fileName}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))
                }
              >
                <MaterialIcons name="close" size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {editingId && (
        <View style={[messagingStyles.pendingAttachRow, { justifyContent: 'space-between' }]}>
          <Text style={messagingStyles.linkText}>Editing message</Text>
          <TouchableOpacity
            onPress={() => {
              setEditingId(null);
              setEditDraft('');
            }}
          >
            <Text style={messagingStyles.convPreview}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {showAttachMenu && (
        <View style={messagingStyles.attachMenu}>
          <TouchableOpacity
            style={messagingStyles.attachMenuBtn}
            onPress={() => void runImagePick('camera')}
            disabled={pickingImage}
          >
            <MaterialIcons name="photo-camera" size={24} color={colors.primary[500]} />
            <Text style={messagingStyles.attachMenuLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={messagingStyles.attachMenuBtn}
            onPress={() => void runImagePick('library')}
            disabled={pickingImage}
          >
            <MaterialIcons name="photo-library" size={24} color={colors.primary[500]} />
            <Text style={messagingStyles.attachMenuLabel}>Library</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={messagingStyles.attachMenuBtn}
            onPress={() => void runImagePick('multi')}
            disabled={pickingImage}
          >
            <MaterialIcons name="collections" size={24} color={colors.primary[500]} />
            <Text style={messagingStyles.attachMenuLabel}>Multi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={messagingStyles.attachMenuBtn}
            onPress={() => setShowAttachMenu(false)}
          >
            <MaterialIcons name="close" size={24} color={colors.text.secondary} />
            <Text style={messagingStyles.attachMenuLabel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={messagingStyles.inputBar}>
        <TouchableOpacity
          style={messagingStyles.iconButton}
          onPress={() => {
            setShowAttachMenu((v) => !v);
            setReactionTargetId(null);
          }}
          disabled={pickingImage || !activeConversationId}
        >
          {pickingImage ? (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          ) : (
            <MaterialIcons name="attach-file" size={20} color={colors.text.secondary} />
          )}
        </TouchableOpacity>
        <TextInput
          style={messagingStyles.textInput}
          placeholder={editingId ? 'Edit messageâ€¦' : 'Type a messageâ€¦'}
          placeholderTextColor={colors.text.tertiary}
          value={editingId ? editDraft : draft}
          onChangeText={editingId ? setEditDraft : setDraft}
          multiline
        />
        <TouchableOpacity
          style={[messagingStyles.sendBtn, sending && { opacity: 0.5 }]}
          onPress={() => void handleSend()}
          disabled={sending}
        >
          <MaterialIcons name={editingId ? 'check' : 'send'} size={20} color={colors.white} />
        </TouchableOpacity>
      </View>

      <MessageImageLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />
    </KeyboardAvoidingView>
  );
}

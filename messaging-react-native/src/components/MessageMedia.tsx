import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import {
  getCachedMessagingMediaUrl,
  getMessagingMediaUrl,
} from '../services/messagingFileService';
import { messagingStyles } from '../styles/messagingStyles';
import type { Message } from '../types/messaging';
import { resolveMessageFileId } from '../utils/messagingHelpers';

export function MessageMedia({
  message,
  onPress,
}: {
  message: Message;
  onPress?: (uri: string) => void;
}) {
  const localUri = message.local_image_uri;
  const fileId = resolveMessageFileId(message);
  const [remoteUri, setRemoteUri] = useState<string | null>(
    fileId ? getCachedMessagingMediaUrl(fileId) : null
  );
  const [loading, setLoading] = useState(!!fileId && !remoteUri && !localUri);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (localUri || !fileId) return;
    const cached = getCachedMessagingMediaUrl(fileId);
    if (cached) {
      setRemoteUri(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getMessagingMediaUrl(fileId)
      .then((uri) => {
        if (!cancelled) {
          setRemoteUri(uri);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, localUri]);

  const uri = localUri || remoteUri || message.media_url;

  if (message.message_type === 'FILE' && !uri) {
    return (
      <View style={[messagingStyles.chatImage, messagingStyles.fileAttachment]}>
        <MaterialIcons name="insert-drive-file" size={32} color={colors.primary[500]} />
        <Text style={messagingStyles.convPreview} numberOfLines={2}>
          {message.attachments?.[0]?.filename || 'Attachment'}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[messagingStyles.chatImage, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary[500]} />
      </View>
    );
  }

  if (!uri || failed) {
    return (
      <View style={[messagingStyles.chatImage, { alignItems: 'center', justifyContent: 'center' }]}>
        <MaterialIcons name="broken-image" size={40} color={colors.text.tertiary} />
        <Text style={messagingStyles.convPreview}>Unavailable</Text>
      </View>
    );
  }

  const image = (
    <Image source={{ uri }} style={messagingStyles.chatImage} contentFit="cover" />
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(uri)}>
        {image}
      </TouchableOpacity>
    );
  }

  return image;
}

import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { messagingStyles } from '../styles/messagingStyles';

export function MessageImageLightbox({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={messagingStyles.lightboxBackdrop}>
        <TouchableOpacity style={messagingStyles.lightboxClose} onPress={onClose}>
          <MaterialIcons name="close" size={28} color={colors.white} />
        </TouchableOpacity>
        {uri ? (
          <Image source={{ uri }} style={messagingStyles.lightboxImage} contentFit="contain" />
        ) : null}
      </View>
    </Modal>
  );
}

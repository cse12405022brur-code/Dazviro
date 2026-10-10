import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';

export default function CreateCommunityPostScreen({ route, navigation }: any) {
  const { communityId, communityName } = route.params;
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  function base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function uploadImage() {
    if (!imageUri) return null;
    if (imageUri.includes('supabase.co')) return imageUri;

    try {
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `community-${communityId}-${user?.id}-${Date.now()}.${fileExt}`;

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const arrayBuffer = base64ToArrayBuffer(base64);

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      Alert.alert('Upload Error', error.message);
      return null;
    }
  }

  async function createPost() {
    if (!content.trim() && !imageUri) {
      Alert.alert('Error', 'Please write something or add a photo.');
      return;
    }

    setLoading(true);

    try {
      const uploadedImageUrl = await uploadImage();

      const { error } = await supabase.from('community_posts').insert({
        community_id: communityId,
        user_id: user?.id,
        content: content.trim(),
        image_url: uploadedImageUrl,
      });

      if (error) throw error;

      Alert.alert('Success', 'Post created successfully!');
      navigation.goBack();

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post to {communityName}</Text>
        <View style={{ width: 24 }} />
      </View>

      <TextInput
        style={styles.input}
        placeholder={`Share something with ${communityName}...`}
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={6}
      />

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.previewImage} />
      )}

      <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
        <Ionicons name="image-outline" size={20} color="#1DA1F2" />
        <Text style={styles.imageButtonText}>
          {imageUri ? 'Change Photo' : 'Add Photo'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.postButton, loading && styles.disabledButton]}
        onPress={createPost}
        disabled={loading}
      >
        <Text style={styles.postButtonText}>
          {loading ? 'Posting...' : 'Post to Community'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#fff' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 20 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 15, borderRadius: 10, marginBottom: 15, height: 150, textAlignVertical: 'top', fontSize: 15 },
  previewImage: { width: '100%', height: 200, borderRadius: 10, marginBottom: 15 },
  imageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1DA1F2', borderRadius: 10, padding: 12, marginBottom: 20 },
  imageButtonText: { color: '#1DA1F2', fontWeight: 'bold', marginLeft: 8 },
  postButton: { backgroundColor: '#1DA1F2', padding: 18, borderRadius: 10, alignItems: 'center' },
  postButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  disabledButton: { backgroundColor: '#a0c4e8' },
});
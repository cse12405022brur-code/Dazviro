import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

export default function CreatePostScreen({ navigation }: any) {
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

  // Base64 কে ArrayBuffer এ কনভার্ট করার সহজ ফাংশন
  function base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function uploadPostImage() {
    if (!imageUri) return null;
    if (imageUri.includes('supabase.co')) return imageUri;

    try {
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // ছবিকে Base64 এ কনভার্ট করা
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const arrayBuffer = base64ToArrayBuffer(base64);

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      console.log('Generated Public URL:', publicUrl);
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
      const uploadedImageUrl = await uploadPostImage();

      const { error } = await supabase.from('posts').insert({
        user_id: user?.id,
        content: content,
        image_url: uploadedImageUrl,
      });

      if (error) throw error;

      Alert.alert('Success', 'Post created successfully!');
      setContent('');
      setImageUri(null);
      navigation.navigate('Home');

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Post</Text>

      <TextInput
        style={styles.input}
        placeholder="What's on your mind?"
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={4}
      />

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.previewImage} />
      )}

      <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
        <Text style={styles.imageButtonText}>
          {imageUri ? 'Change Photo' : '+ Add Photo'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.postButton, loading && styles.disabledButton]} 
        onPress={createPost} 
        disabled={loading}
      >
        <Text style={styles.postButtonText}>
          {loading ? 'Posting...' : 'Post'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 16, height: 120, textAlignVertical: 'top' },
  previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 16 },
  imageButton: { borderWidth: 1, borderColor: '#1DA1F2', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  imageButtonText: { color: '#1DA1F2', fontWeight: 'bold' },
  postButton: { backgroundColor: '#1DA1F2', padding: 15, borderRadius: 8, alignItems: 'center' },
  postButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  disabledButton: { backgroundColor: '#a0c4e8' },
});
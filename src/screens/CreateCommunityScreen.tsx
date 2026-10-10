import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ScrollView, Switch } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';

export default function CreateCommunityScreen({ navigation }: any) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  // Base64 থেকে ArrayBuffer এ কনভার্ট করার ফাংশন
  function base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // ছবি Supabase Storage এ আপলোড করার ফাংশন
  async function uploadImage() {
    if (!imageUri) return null;

    try {
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `community-${user?.id}-${Date.now()}.${fileExt}`;

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const arrayBuffer = base64ToArrayBuffer(base64);

      const { error: uploadError } = await supabase.storage
        .from('avatars') // আপাতত avatars বাকেট ব্যবহার করছি, চাইলে আলাদা বানাতে পারি
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      Alert.alert('Upload Error', error.message);
      return null;
    }
  }

  async function createCommunity() {
    if (!name.trim()) {
      Alert.alert('Error', 'Community name is required');
      return;
    }

    setLoading(true);

    try {
      let uploadedImageUrl = null;
      if (imageUri) {
        uploadedImageUrl = await uploadImage();
      }

      // কমিউনিটি তৈরি কর
      const { data: newCommunity, error: communityError } = await supabase
        .from('communities')
        .insert({
          name: name.trim(),
          description: description.trim(),
          image_url: uploadedImageUrl,
          owner_id: user?.id,
          is_private: isPrivate,
        })
        .select()
        .single();

      if (communityError) throw communityError;

      // মালিককে প্রথম মেম্বার হিসেবে যোগ কর
      const { error: memberError } = await supabase
        .from('community_members')
        .insert({
          community_id: newCommunity.id,
          user_id: user?.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      Alert.alert('Success', 'Community created successfully!');
      navigation.navigate('CommunityDetail', { communityId: newCommunity.id });

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
        <Text style={styles.headerTitle}>Create Community</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.title}>New Community</Text>
      <Text style={styles.subtitle}>Create a space for your people</Text>

      {/* ছবি পিকার */}
      <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="camera" size={40} color="#999" />
            <Text style={styles.imagePlaceholderText}>Add Community Photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Community Name *"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={[styles.input, styles.bioInput]}
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {/* Private/Public Toggle */}
      <View style={styles.switchContainer}>
        <View style={styles.switchInfo}>
          <Ionicons name={isPrivate ? 'lock-closed' : 'globe-outline'} size={20} color="#666" />
          <Text style={styles.switchLabel}>
            {isPrivate ? 'Private Community' : 'Public Community'}
          </Text>
        </View>
        <Switch
          value={isPrivate}
          onValueChange={setIsPrivate}
          trackColor={{ false: '#767577', true: '#1DA1F2' }}
        />
      </View>
      <Text style={styles.switchHint}>
        {isPrivate
          ? 'Only members can see posts and join.'
          : 'Anyone can see posts and join this community.'}
      </Text>

      <TouchableOpacity
        style={[styles.createButton, loading && styles.disabledButton]}
        onPress={createCommunity}
        disabled={loading}
      >
        <Text style={styles.createButtonText}>
          {loading ? 'Creating...' : 'Create Community'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#fff' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 5, marginBottom: 30 },
  
  imagePicker: { alignSelf: 'center', marginBottom: 25 },
  previewImage: { width: 120, height: 120, borderRadius: 60 },
  imagePlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed' },
  imagePlaceholderText: { fontSize: 11, color: '#999', marginTop: 8, textAlign: 'center' },
  
  input: { borderWidth: 1, borderColor: '#ccc', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 15 },
  bioInput: { height: 100, textAlignVertical: 'top' },
  
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 5 },
  switchInfo: { flexDirection: 'row', alignItems: 'center' },
  switchLabel: { fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  switchHint: { fontSize: 13, color: '#999', marginBottom: 25, marginLeft: 30 },
  
  createButton: { backgroundColor: '#1DA1F2', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  createButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  disabledButton: { backgroundColor: '#a0c4e8' },
});
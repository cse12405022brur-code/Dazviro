import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ScrollView, Modal, Dimensions } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isProfileSetup, setIsProfileSetup] = useState(false);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getProfile();
      getUserPosts();
      getUnreadCount();
    }
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) {
        getUnreadCount();
        getProfile();
      }
    });
    return unsubscribe;
  }, [navigation, user]);

  async function getProfile() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setUsername(data.username || '');
        setFullName(data.full_name || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url);
        setIsAdmin(data.is_admin || false);
      } else {
        setIsProfileSetup(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function getUserPosts() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserPosts(data || []);
    } catch (error: any) {
      console.log('Error fetching user posts:', error.message);
    }
  }

  async function getUnreadCount() {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);
      
      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error: any) {
      console.log('Error getting unread count:', error.message);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
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

  async function uploadAvatar() {
    if (!avatarUrl) return null;
    if (avatarUrl.includes('supabase.co')) return avatarUrl;

    try {
      const fileExt = avatarUrl.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const base64 = await FileSystem.readAsStringAsync(avatarUrl, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const arrayBuffer = base64ToArrayBuffer(base64);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      Alert.alert('Upload Error', error.message);
      return null;
    }
  }

  async function saveProfile() {
    if (!username || !fullName) {
      Alert.alert('Error', 'Username and Full Name are required');
      return;
    }

    setLoading(true);

    const uploadedAvatarUrl = await uploadAvatar();

    const updates = {
      id: user?.id,
      username,
      full_name: fullName,
      bio,
      avatar_url: uploadedAvatarUrl || avatarUrl,
      updated_at: new Date(),
    };

    const { error } = await supabase.from('profiles').upsert(updates);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Profile saved successfully!');
      setIsProfileSetup(false);
    }
    setLoading(false);
  }

  if (loading) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  if (isProfileSetup) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Setup Your Profile</Text>
        
        <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarPlaceholder}>+ Add Photo</Text>
          )}
        </TouchableOpacity>

        <TextInput style={styles.input} placeholder="Username (unique)" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Full Name" value={fullName} onChangeText={setFullName} />
        <TextInput style={[styles.input, styles.bioInput]} placeholder="Bio" value={bio} onChangeText={setBio} multiline />

        <TouchableOpacity style={styles.button} onPress={saveProfile}>
          <Text style={styles.buttonText}>Save Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Profile</Text>
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={26} color="#000" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.mainContainer}>
        <View style={styles.profileHeader}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholderView}>
              <Text style={styles.avatarPlaceholderText}>{fullName?.charAt(0)}</Text>
            </View>
          )}
          
          <Text style={styles.nameText}>{fullName}</Text>
          <Text style={styles.usernameText}>@{username}</Text>
          <Text style={styles.bioText}>{bio || 'No bio yet'}</Text>

          {/* Admin Badge */}
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#1DA1F2" />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}

          <TouchableOpacity style={styles.editButton} onPress={() => setIsProfileSetup(true)}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>My Posts ({userPosts.length})</Text>
          
          {userPosts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Ionicons name="document-text-outline" size={40} color="#ccc" />
              <Text style={styles.emptyPostsText}>You haven't posted anything yet.</Text>
            </View>
          ) : (
            userPosts.map((post) => (
              <View key={post.id} style={styles.postItem}>
                <Text style={styles.postContent}>{post.content}</Text>
                {post.image_url && (
                  <TouchableOpacity onPress={() => setSelectedImage(post.image_url)}>
                    <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" />
                  </TouchableOpacity>
                )}
                <Text style={styles.postDate}>
                  {new Date(post.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Admin Panel বাটন - শুধু অ্যাডমিনদের জন্য */}
        {isAdmin && (
          <TouchableOpacity 
            style={[styles.settingsButton, styles.adminPanelButton]} 
            onPress={() => navigation.navigate('AdminModeration')}
          >
            <Ionicons name="shield-outline" size={20} color="#e0245e" />
            <Text style={[styles.settingsButtonText, { color: '#e0245e' }]}>Admin Panel</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        )}

        {/* Blocked Users বাটন */}
        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => navigation.navigate('BlockedUsers')}
        >
          <Ionicons name="ban-outline" size={20} color="#666" />
          <Text style={styles.settingsButtonText}>Blocked Users</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 20, backgroundColor: '#fff', justifyContent: 'center' },
  
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  topBarTitle: { fontSize: 24, fontWeight: 'bold' },
  notificationButton: { padding: 5, position: 'relative' },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#e0245e', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  avatarContainer: { alignSelf: 'center', marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#eee', textAlign: 'center', lineHeight: 100, color: '#666' },
  avatarPlaceholderView: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 16 },
  bioInput: { height: 80, textAlignVertical: 'top' },
  button: { backgroundColor: '#1DA1F2', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { marginTop: 15, marginBottom: 30, alignItems: 'center', padding: 15, borderWidth: 1, borderColor: 'red', borderRadius: 8, marginHorizontal: 20 },
  logoutText: { color: 'red', fontSize: 16, fontWeight: 'bold' },
  
  profileHeader: { alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  nameText: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
  usernameText: { fontSize: 16, color: 'gray', marginTop: 5 },
  bioText: { fontSize: 15, textAlign: 'center', marginTop: 10, color: '#444' },
  editButton: { marginTop: 15, borderWidth: 1, borderColor: '#1DA1F2', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  editButtonText: { color: '#1DA1F2', fontWeight: 'bold' },
  
  // Admin Badge
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f4fd', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15, marginTop: 10 },
  adminBadgeText: { color: '#1DA1F2', fontWeight: 'bold', fontSize: 12, marginLeft: 5 },

  postsSection: { padding: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  emptyPosts: { alignItems: 'center', padding: 30 },
  emptyPostsText: { color: '#999', marginTop: 10 },
  postItem: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  postContent: { fontSize: 15, marginBottom: 8 },
  postImage: { width: '100%', height: 250, borderRadius: 8, marginBottom: 8, backgroundColor: '#eee' },
  postDate: { fontSize: 12, color: '#999' },

  // Settings Buttons
  settingsButton: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, padding: 15, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginTop: 10 },
  settingsButtonText: { marginLeft: 10, fontSize: 15, color: '#333', fontWeight: '500', flex: 1 },
  adminPanelButton: { borderColor: '#e0245e', backgroundColor: '#fef5f7' },

  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: width, height: '80%' },
});
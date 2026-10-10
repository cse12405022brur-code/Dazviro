import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, ScrollView, Modal, TextInput, Share } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

export default function CommunityDetailScreen({ route, navigation }: any) {
  const { communityId } = route.params;
  const { user } = useAuth();

  const [community, setCommunity] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [editedImageUri, setEditedImageUri] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCommunityData();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCommunityData();
    });
    return unsubscribe;
  }, [navigation]);

  async function fetchCommunityData() {
    try {
      setLoading(true);

      const { data: communityData, error: commError } = await supabase
        .from('communities')
        .select(`*, profiles:owner_id (id, username, full_name, avatar_url)`)
        .eq('id', communityId)
        .single();
      if (commError) throw commError;
      setCommunity(communityData);

      const { data: membersData, error: memberError } = await supabase
        .from('community_members')
        .select(`*, profiles:user_id (id, username, full_name, avatar_url)`)
        .eq('community_id', communityId);
      if (memberError) throw memberError;
      setMembers(membersData || []);

      const myMembership = (membersData || []).find((m: any) => m.user_id === user?.id);
      setIsMember(!!myMembership);
      setIsAdmin(myMembership?.role === 'admin');

      // কমিউনিটি পোস্ট + লাইক
      const { data: postsData, error: postsError } = await supabase
        .from('community_posts')
        .select(`
          *,
          profiles:user_id (id, username, full_name, avatar_url),
          community_post_likes (user_id)
        `)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });
      if (postsError) throw postsError;
      setPosts(postsData || []);

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function joinCommunity() {
    try {
      const { error } = await supabase
        .from('community_members')
        .insert({ community_id: communityId, user_id: user?.id });
      if (error) throw error;
      Alert.alert('Success', 'Joined community!');
      fetchCommunityData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  async function leaveCommunity() {
    Alert.alert('Leave Community', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('community_members')
              .delete()
              .eq('community_id', communityId)
              .eq('user_id', user?.id);
            if (error) throw error;
            Alert.alert('Success', 'You left the community.');
            navigation.goBack();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  }

  // লাইক টগল
  async function toggleLike(post: any) {
    const likes = post.community_post_likes || [];
    const isLiked = likes.some((like: any) => like.user_id === user?.id);

    const updatedPosts = posts.map((p) => {
      if (p.id === post.id) {
        if (isLiked) {
          return { ...p, community_post_likes: likes.filter((l: any) => l.user_id !== user?.id) };
        } else {
          return { ...p, community_post_likes: [...likes, { user_id: user?.id }] };
        }
      }
      return p;
    });
    setPosts(updatedPosts);

    try {
      if (isLiked) {
        await supabase.from('community_post_likes').delete().eq('post_id', post.id).eq('user_id', user?.id);
      } else {
        await supabase.from('community_post_likes').insert({ post_id: post.id, user_id: user?.id });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
      fetchCommunityData();
    }
  }

  // শেয়ার
  async function onShare(post: any) {
    try {
      await Share.share({
        message: `${post.profiles?.full_name} (@${post.profiles?.username}) এর কমিউনিটি পোস্ট:\n\n"${post.content}"\n\nDazviro অ্যাপে দেখুন!`,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  function deleteCommunityPost(postId: string) {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('community_posts').delete().eq('id', postId);
            if (error) throw error;
            setPosts(posts.filter((p) => p.id !== postId));
            Alert.alert('Success', 'Post deleted successfully!');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  }

  function openEditModal(post: any) {
    setEditingPostId(post.id);
    setEditedContent(post.content);
    setEditedImageUri(null);
    setExistingImageUrl(post.image_url);
    setIsEditModalVisible(true);
  }

  async function pickEditImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      setEditedImageUri(result.assets[0].uri);
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

  async function uploadPostImage(imageUri: string) {
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

  async function saveEditedPost() {
    if (!editedContent.trim() || !editingPostId) return;
    setSaving(true);

    try {
      let finalImageUrl = existingImageUrl;

      if (editedImageUri) {
        const uploadedUrl = await uploadPostImage(editedImageUri);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        }
      }

      const { error } = await supabase
        .from('community_posts')
        .update({
          content: editedContent.trim(),
          image_url: finalImageUrl,
          updated_at: new Date(),
        })
        .eq('id', editingPostId);

      if (error) throw error;

      setPosts(posts.map((p) =>
        p.id === editingPostId
          ? { ...p, content: editedContent.trim(), image_url: finalImageUrl }
          : p
      ));
      setIsEditModalVisible(false);
      Alert.alert('Success', 'Post updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  }

  function getTimeAgo(dateString: string): string {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1DA1F2" /></View>;
  }

  if (!community) {
    return <View style={styles.loadingContainer}><Text>Community not found</Text></View>;
  }

  const renderHeader = () => (
    <View>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.communityHeader}>
        {community.image_url ? (
          <Image source={{ uri: community.image_url }} style={styles.communityImage} />
        ) : (
          <View style={styles.communityImagePlaceholder}>
            <Ionicons name="people" size={40} color="#fff" />
          </View>
        )}
        <Text style={styles.communityName}>{community.name}</Text>
        {community.description && (
          <Text style={styles.communityDescription}>{community.description}</Text>
        )}
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={16} color="#666" />
          <Text style={styles.metaText}>{members.length} members</Text>
          {community.is_private && (
            <>
              <Ionicons name="lock-closed" size={16} color="#666" style={{ marginLeft: 15 }} />
              <Text style={styles.metaText}>Private</Text>
            </>
          )}
        </View>

        {!isMember ? (
          <TouchableOpacity style={styles.joinButton} onPress={joinCommunity}>
            <Text style={styles.joinButtonText}>Join Community</Text>
          </TouchableOpacity>
        ) : !isAdmin ? (
          <TouchableOpacity style={styles.leaveButton} onPress={leaveCommunity}>
            <Text style={styles.leaveButtonText}>Leave Community</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={18} color="#1DA1F2" />
            <Text style={styles.adminBadgeText}>You are the Admin</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Members ({members.length})</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersRow}>
        {members.map((m) => (
          <View key={m.id} style={styles.memberItem}>
            {m.profiles?.avatar_url ? (
              <Image source={{ uri: m.profiles.avatar_url }} style={styles.memberAvatar} />
            ) : (
              <View style={styles.memberAvatarPlaceholder}>
                <Text style={styles.memberAvatarText}>{m.profiles?.full_name?.charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.memberName} numberOfLines={1}>
              {m.profiles?.username}
            </Text>
          </View>
        ))}
      </ScrollView>

      {isMember && (
        <TouchableOpacity 
          style={styles.createPostButton}
          onPress={() => navigation.navigate('CreateCommunityPost', { 
            communityId: community.id, 
            communityName: community.name 
          })}
        >
          <Ionicons name="create-outline" size={20} color="#1DA1F2" />
          <Text style={styles.createPostButtonText}>Create a Post</Text>
        </TouchableOpacity>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Community Posts ({posts.length})</Text>
      </View>
    </View>
  );

  const renderPost = ({ item }: { item: any }) => {
    const isOwner = user?.id === item.user_id;
    const isAdminOfCommunity = isAdmin;

    const likesArray = item.community_post_likes || [];
    const likeCount = likesArray.length;
    const isLiked = likesArray.some((like: any) => like.user_id === user?.id);

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          {item.profiles?.avatar_url ? (
            <Image source={{ uri: item.profiles.avatar_url }} style={styles.postAvatar} />
          ) : (
            <View style={styles.postAvatarPlaceholder}>
              <Text style={styles.postAvatarText}>{item.profiles?.full_name?.charAt(0)}</Text>
            </View>
          )}
          <View style={styles.postHeaderInfo}>
            <Text style={styles.postName}>{item.profiles?.full_name}</Text>
            <Text style={styles.postUsername}>@{item.profiles?.username} · {getTimeAgo(item.created_at)}</Text>
          </View>
          
          {(isOwner || isAdminOfCommunity) && (
            <View style={styles.postActions}>
              {isOwner && (
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconButton}>
                  <Ionicons name="create-outline" size={18} color="#666" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => deleteCommunityPost(item.id)} style={styles.iconButton}>
                <Ionicons name="trash-outline" size={18} color="#e0245e" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={styles.postContent}>{item.content}</Text>
        {item.image_url && (
          <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
        )}

        {/* Like, Comment, Share বাটন */}
        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.footerButton} onPress={() => toggleLike(item)}>
            <Ionicons 
              name={isLiked ? 'heart' : 'heart-outline'} 
              size={22} 
              color={isLiked ? '#e0245e' : '#666'} 
            />
            <Text style={[styles.footerText, isLiked && styles.likedText]}>
              {likeCount > 0 ? likeCount : 'Like'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerButton}>
            <Ionicons name="chatbubble-outline" size={22} color="#666" />
            <Text style={styles.footerText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerButton} onPress={() => onShare(item)}>
            <Ionicons name="share-outline" size={22} color="#666" />
            <Text style={styles.footerText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyPosts}>
            <Ionicons name="document-text-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>No posts in this community yet.</Text>
          </View>
        }
      />

      <Modal visible={isEditModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Edit Post</Text>
            
            <TextInput
              style={styles.editInput}
              value={editedContent}
              onChangeText={setEditedContent}
              multiline
            />

            {(editedImageUri || existingImageUrl) && (
              <Image 
                source={{ uri: editedImageUri || existingImageUrl || '' }} 
                style={styles.editImagePreview} 
              />
            )}

            <TouchableOpacity style={styles.changePhotoButton} onPress={pickEditImage}>
              <Ionicons name="image-outline" size={20} color="#1DA1F2" />
              <Text style={styles.changePhotoText}>
                {editedImageUri || existingImageUrl ? 'Change Photo' : 'Add Photo'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, saving && styles.disabledSaveButton]} 
                onPress={saveEditedPost}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  listContainer: { paddingBottom: 20 },
  
  communityHeader: { alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  communityImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 15 },
  communityImagePlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  communityName: { fontSize: 24, fontWeight: 'bold' },
  communityDescription: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  metaText: { fontSize: 14, color: '#666', marginLeft: 5 },
  
  joinButton: { backgroundColor: '#1DA1F2', paddingHorizontal: 40, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  joinButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  leaveButton: { borderWidth: 1, borderColor: '#e0245e', paddingHorizontal: 40, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  leaveButtonText: { color: '#e0245e', fontWeight: 'bold', fontSize: 15 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f4fd', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  adminBadgeText: { color: '#1DA1F2', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  
  membersRow: { paddingHorizontal: 15, paddingVertical: 15 },
  memberItem: { alignItems: 'center', marginHorizontal: 8, width: 70 },
  memberAvatar: { width: 50, height: 50, borderRadius: 25 },
  memberAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  memberName: { fontSize: 12, color: '#666', marginTop: 5 },

  createPostButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, marginTop: 15, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#1DA1F2' },
  createPostButtonText: { color: '#1DA1F2', fontWeight: 'bold', marginLeft: 8, fontSize: 15 },
  
  postCard: { paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  postAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  postAvatarText: { color: '#fff', fontWeight: 'bold' },
  postHeaderInfo: { flex: 1 },
  postName: { fontWeight: 'bold', fontSize: 14 },
  postUsername: { fontSize: 12, color: '#666' },
  postActions: { flexDirection: 'row' },
  iconButton: { marginLeft: 10, padding: 5 },
  postContent: { fontSize: 15, marginBottom: 10 },
  postImage: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#eee', marginBottom: 10 },
  
  // Post Footer (Like, Comment, Share)
  postFooter: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 5 },
  footerButton: { flexDirection: 'row', alignItems: 'center' },
  footerText: { marginLeft: 5, color: '#666', fontSize: 14 },
  likedText: { color: '#e0245e', fontWeight: 'bold' },
  
  emptyPosts: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#999', marginTop: 10 },

  // Edit Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  editModalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 20, width: '90%' },
  editModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  editInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, height: 100, textAlignVertical: 'top', marginBottom: 15 },
  editImagePreview: { width: '100%', height: 150, borderRadius: 8, marginBottom: 10 },
  changePhotoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1DA1F2', borderRadius: 8, padding: 10, marginBottom: 15 },
  changePhotoText: { color: '#1DA1F2', fontWeight: 'bold', marginLeft: 5 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', marginRight: 10, alignItems: 'center' },
  cancelButtonText: { color: '#666', fontWeight: 'bold' },
  saveButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#1DA1F2', marginLeft: 10, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
  disabledSaveButton: { backgroundColor: '#a0c4e8' },
});
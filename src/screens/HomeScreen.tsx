import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Image, TouchableOpacity, Alert, Modal, Dimensions, Share, TextInput } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Post, Profile } from '../types';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import ReportModal from '../components/ReportModal';

const { width } = Dimensions.get('window');

type PostWithDetails = Post & {
  profiles: Profile;
  post_likes: { user_id: string }[];
  comments: { id: string }[];
};

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [editedImageUri, setEditedImageUri] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // Report Modal State
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user?.id);

      if (followingError) throw followingError;
      const followingIds = (followingData || []).map((f: any) => f.following_id);

      const { data: blockedData, error: blockedError } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', user?.id);

      if (blockedError) throw blockedError;
      const blockedIds = (blockedData || []).map((b: any) => b.blocked_id);

      const feedUserIds = [user?.id, ...followingIds].filter(
        (id) => !blockedIds.includes(id)
      );

      if (feedUserIds.length === 0) {
        setPosts([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (id, username, full_name, avatar_url),
          post_likes (user_id),
          comments (id)
        `)
        .in('user_id', feedUserIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data as PostWithDetails[]);
    } catch (error: any) {
      Alert.alert('Error fetching posts', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPosts();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, []);

  const toggleLike = async (post: PostWithDetails) => {
    const likes = post.post_likes || [];
    const isLiked = likes.some((like) => like.user_id === user?.id);

    const updatedPosts = posts.map((p) => {
      if (p.id === post.id) {
        if (isLiked) {
          return { ...p, post_likes: likes.filter((like) => like.user_id !== user?.id) };
        } else {
          return { ...p, post_likes: [...likes, { user_id: user?.id || '' }] };
        }
      }
      return p;
    });
    setPosts(updatedPosts);

    try {
      if (isLiked) {
        const { error } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user?.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: user?.id });
        if (error) throw error;
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
      fetchPosts();
    }
  };

  const onShare = async (post: PostWithDetails) => {
    try {
      await Share.share({
        message: `${post.profiles?.full_name} (@${post.profiles?.username}) এর পোস্ট:\n\n"${post.content}"\n\nDazviro অ্যাপে দেখুন!`,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const deletePost = (postId: string) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('posts').delete().eq('id', postId);
              if (error) throw error;
              setPosts(posts.filter((p) => p.id !== postId));
              Alert.alert('Success', 'Post deleted successfully!');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const openEditModal = (post: PostWithDetails) => {
    setEditingPostId(post.id);
    setEditedContent(post.content);
    setEditedImageUri(null);
    setExistingImageUrl(post.image_url);
    setIsEditModalVisible(true);
  };

  const openReportModal = (postId: string) => {
    setReportTargetId(postId);
    setReportModalVisible(true);
  };

  const pickEditImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setEditedImageUri(result.assets[0].uri);
    }
  };

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
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;

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

  const saveEditedPost = async () => {
    if (!editedContent.trim() || !editingPostId) return;
    
    try {
      let finalImageUrl = existingImageUrl;

      if (editedImageUri) {
        const uploadedUrl = await uploadPostImage(editedImageUri);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        }
      }

      const { error } = await supabase
        .from('posts')
        .update({ 
          content: editedContent.trim(), 
          image_url: finalImageUrl,
          updated_at: new Date() 
        })
        .eq('id', editingPostId);
      
      if (error) throw error;
      
      setPosts(posts.map((p) => p.id === editingPostId ? { ...p, content: editedContent.trim(), image_url: finalImageUrl } : p));
      setIsEditModalVisible(false);
      Alert.alert('Success', 'Post updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const renderPost = ({ item }: { item: PostWithDetails }) => {
    const profile = item.profiles;
    const timeAgo = getTimeAgo(item.created_at);
    const isOwner = user?.id === item.user_id;
    
    const likesArray = item.post_likes || [];
    const commentsArray = item.comments || [];
    
    const likeCount = likesArray.length;
    const commentCount = commentsArray.length;
    const isLiked = likesArray.some((like) => like.user_id === user?.id);

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <TouchableOpacity 
            style={styles.postHeaderLeft} 
            onPress={() => navigation.navigate('UserProfile', { userId: item.user_id })}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>{profile?.full_name?.charAt(0) || '?'}</Text>
              </View>
            )}
            <View style={styles.postHeaderText}>
              <Text style={styles.fullName}>{profile?.full_name || 'Unknown User'}</Text>
              <Text style={styles.username}>@{profile?.username || 'unknown'} · {timeAgo}</Text>
            </View>
          </TouchableOpacity>

          {isOwner ? (
            <View style={styles.postOwnerActions}>
              <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconButton}>
                <Ionicons name="create-outline" size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deletePost(item.id)} style={styles.iconButton}>
                <Ionicons name="trash-outline" size={20} color="#e0245e" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => openReportModal(item.id)} style={styles.iconButton}>
              <Ionicons name="flag-outline" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.postContent}>{item.content}</Text>

        {item.image_url && (
          <TouchableOpacity onPress={() => setSelectedImage(item.image_url)}>
            <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
          </TouchableOpacity>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => toggleLike(item)}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? '#e0245e' : '#666'} />
            <Text style={[styles.actionText, isLiked && styles.likedText]}>{likeCount > 0 ? likeCount : 'Like'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
            <Ionicons name="chatbubble-outline" size={24} color="#666" />
            <Text style={styles.actionText}>{commentCount > 0 ? commentCount : 'Comment'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => onShare(item)}>
            <Ionicons name="share-outline" size={24} color="#666" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1DA1F2" /></View>;
  }

  if (posts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="newspaper-outline" size={60} color="#ccc" />
        <Text style={styles.emptyText}>No posts yet.</Text>
        <Text style={styles.emptySubtext}>Follow people or create your first post!</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1DA1F2']} />}
      />

      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>

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
              <TouchableOpacity style={styles.saveButton} onPress={saveEditedPost}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        reportType="post"
        targetId={reportTargetId || ''}
        targetName={posts.find((p) => p.id === reportTargetId)?.content?.substring(0, 30)}
      />
    </View>
  );
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

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#666', marginTop: 15 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5, textAlign: 'center' },
  listContainer: { padding: 10, paddingBottom: 20 },
  postCard: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: '#fff', fontWeight: 'bold' },
  postHeaderText: { marginLeft: 10, flex: 1 },
  fullName: { fontWeight: 'bold', fontSize: 15 },
  username: { color: '#666', fontSize: 13 },
  postOwnerActions: { flexDirection: 'row' },
  iconButton: { marginLeft: 10, padding: 5 },

  postContent: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  postImage: { width: '100%', height: 250, borderRadius: 8, marginBottom: 10, backgroundColor: '#eee' },
  postActions: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 5 },
  actionButton: { flexDirection: 'row', alignItems: 'center' },
  actionText: { marginLeft: 5, color: '#666', fontSize: 14 },
  likedText: { color: '#e0245e', fontWeight: 'bold' },
  
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: width, height: '80%' },
  
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
});
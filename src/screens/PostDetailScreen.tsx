import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function PostDetailScreen({ route, navigation }: any) {
  const { postId } = route.params;
  const { user } = useAuth();
  
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  useEffect(() => {
    fetchPostDetails();
    fetchComments();
  }, [postId]);

  async function fetchPostDetails() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`*, profiles (id, username, full_name, avatar_url)`)
        .eq('id', postId)
        .single();
      if (error) throw error;
      setPost(data);
      setEditedContent(data.content);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  async function fetchComments() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select(`*, profiles (id, username, full_name, avatar_url)`)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: postId,
        user_id: user?.id,
        content: newComment.trim(),
      });
      if (error) throw error;
      setNewComment('');
      fetchComments();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePost() {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('posts').delete().eq('id', postId);
            if (error) throw error;
            Alert.alert('Success', 'Post deleted successfully!');
            navigation.goBack();
          } catch (error: any) { Alert.alert('Error', error.message); }
        }
      }
    ]);
  }

  async function updatePost() {
    if (!editedContent.trim()) return;
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editedContent.trim(), updated_at: new Date() })
        .eq('id', postId);
      if (error) throw error;
      setIsEditModalVisible(false);
      fetchPostDetails();
      Alert.alert('Success', 'Post updated successfully!');
    } catch (error: any) { Alert.alert('Error', error.message); }
  }

  if (!post) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1DA1F2" /></View>;
  }

  const isOwner = user?.id === post.user_id;

  const renderHeader = () => (
    <View>
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          {post.profiles?.avatar_url ? (
            <Image source={{ uri: post.profiles.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>{post.profiles?.full_name?.charAt(0)}</Text>
            </View>
          )}
          <View style={styles.postHeaderText}>
            <Text style={styles.fullName}>{post.profiles?.full_name}</Text>
            <Text style={styles.username}>@{post.profiles?.username}</Text>
          </View>
        </View>
        <Text style={styles.postContent}>{post.content}</Text>
        {post.image_url && (
          <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" />
        )}
      </View>
      <View style={styles.commentsHeader}>
        <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
      </View>
    </View>
  );

  const renderComment = ({ item }: { item: any }) => (
    <View style={styles.commentItem}>
      {item.profiles?.avatar_url ? (
        <Image source={{ uri: item.profiles.avatar_url }} style={styles.commentAvatar} />
      ) : (
        <View style={styles.commentAvatarPlaceholder}>
          <Text style={styles.commentAvatarText}>{item.profiles?.full_name?.charAt(0)}</Text>
        </View>
      )}
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentName}>{item.profiles?.full_name}</Text>
          <Text style={styles.commentUsername}>@{item.profiles?.username}</Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        
        {isOwner ? (
          <View style={styles.postOwnerActions}>
            <TouchableOpacity onPress={() => setIsEditModalVisible(true)} style={styles.iconButton}>
              <Ionicons name="create-outline" size={22} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity onPress={deletePost} style={styles.iconButton}>
              <Ionicons name="trash-outline" size={22} color="#e0245e" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#1DA1F2" />
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyComments}>
              <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder="Write a comment..." value={newComment} onChangeText={setNewComment} multiline />
        <TouchableOpacity style={[styles.sendButton, (!newComment.trim() || submitting) && styles.disabledButton]} onPress={submitComment} disabled={!newComment.trim() || submitting}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal visible={isEditModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Edit Post</Text>
            <TextInput style={styles.editInput} value={editedContent} onChangeText={setEditedContent} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={updatePost}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  listContainer: { padding: 15 },
  postCard: { backgroundColor: '#fff', borderRadius: 10, padding: 15, borderWidth: 1, borderColor: '#eee', marginBottom: 15 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: '#fff', fontWeight: 'bold' },
  postHeaderText: { marginLeft: 10, flex: 1 },
  fullName: { fontWeight: 'bold', fontSize: 15 },
  username: { color: '#666', fontSize: 13 },
  postOwnerActions: { flexDirection: 'row' },
  iconButton: { marginLeft: 15, padding: 5 },
  postContent: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  postImage: { width: '100%', height: 200, borderRadius: 8, marginTop: 5 },
  commentsHeader: { borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10, marginBottom: 10 },
  commentsTitle: { fontSize: 16, fontWeight: 'bold' },
  commentItem: { flexDirection: 'row', marginBottom: 15 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  commentContent: { flex: 1, marginLeft: 10, backgroundColor: '#f5f5f5', padding: 10, borderRadius: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  commentName: { fontWeight: 'bold', fontSize: 13, marginRight: 5 },
  commentUsername: { color: '#666', fontSize: 12 },
  commentText: { fontSize: 14, lineHeight: 20 },
  emptyComments: { alignItems: 'center', padding: 30 },
  emptyText: { color: '#999', fontSize: 14 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10, maxHeight: 100 },
  sendButton: { backgroundColor: '#1DA1F2', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  disabledButton: { backgroundColor: '#a0c4e8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  editModalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 20, width: '90%' },
  editModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  editInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, height: 100, textAlignVertical: 'top', marginBottom: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', marginRight: 10, alignItems: 'center' },
  cancelButtonText: { color: '#666', fontWeight: 'bold' },
  saveButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#1DA1F2', marginLeft: 10, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
});
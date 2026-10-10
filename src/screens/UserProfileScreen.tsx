import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal, Dimensions } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function UserProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchProfileData();
  }, [userId]);

  async function fetchProfileData() {
    try {
      setLoading(true);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          post_likes (user_id),
          comments (id)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (postsError) throw postsError;
      setUserPosts(postsData || []);

      const { count: followers } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);
      setFollowersCount(followers || 0);

      const { count: following } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);
      setFollowingCount(following || 0);

      const { data: followCheck } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user?.id)
        .eq('following_id', userId)
        .maybeSingle();
      setIsFollowing(!!followCheck);

      const { data: blockCheck } = await supabase
        .from('blocks')
        .select('*')
        .eq('blocker_id', user?.id)
        .eq('blocked_id', userId)
        .maybeSingle();
      setIsBlocked(!!blockCheck);

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFollow() {
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user?.id)
          .eq('following_id', userId);
        if (error) throw error;
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: user?.id, following_id: userId });
        if (error) throw error;
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  // ব্লক/আনব্লক
  async function toggleBlock() {
    if (isBlocked) {
      Alert.alert('Unblock User', `Are you sure you want to unblock ${profile.full_name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('blocks')
                .delete()
                .eq('blocker_id', user?.id)
                .eq('blocked_id', userId);
              if (error) throw error;
              setIsBlocked(false);
              Alert.alert('Success', 'User unblocked.');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]);
    } else {
      Alert.alert('Block User', `Are you sure you want to block ${profile.full_name}? They won't be able to message or follow you.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('follows').delete().eq('follower_id', user?.id).eq('following_id', userId);
              await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', user?.id);

              const { error } = await supabase
                .from('blocks')
                .insert({ blocker_id: user?.id, blocked_id: userId });
              if (error) throw error;
              
              setIsBlocked(true);
              setIsFollowing(false);
              Alert.alert('Success', 'User blocked.');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]);
    }
  }

  async function startConversation() {
    if (isBlocked) {
      Alert.alert('Blocked', 'You cannot message this user.');
      return;
    }
    try {
      const { data: existingConv, error: existingError } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(user1_id.eq.${user?.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${user?.id})`)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingConv) {
        navigation.navigate('Chat', { 
          conversationId: existingConv.id, 
          otherUserId: userId,
          otherUserName: profile.full_name,
          otherUserAvatar: profile.avatar_url
        });
      } else {
        const { data: newConv, error: newError } = await supabase
          .from('conversations')
          .insert({ user1_id: user?.id, user2_id: userId })
          .select()
          .single();

        if (newError) throw newError;

        navigation.navigate('Chat', { 
          conversationId: newConv.id, 
          otherUserId: userId,
          otherUserName: profile.full_name,
          otherUserAvatar: profile.avatar_url
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  async function toggleLike(post: any) {
    const likes = post.post_likes || [];
    const isLiked = likes.some((like: any) => like.user_id === user?.id);

    const updatedPosts = userPosts.map((p) => {
      if (p.id === post.id) {
        if (isLiked) {
          return { ...p, post_likes: likes.filter((like: any) => like.user_id !== user?.id) };
        } else {
          return { ...p, post_likes: [...likes, { user_id: user?.id }] };
        }
      }
      return p;
    });
    setUserPosts(updatedPosts);

    try {
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user?.id);
      } else {
        await supabase.from('post_likes').insert({ post_id: post.id, user_id: user?.id });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
      fetchProfileData();
    }
  }

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1DA1F2" /></View>;
  }

  if (!profile) {
    return <View style={styles.loadingContainer}><Text>Profile not found</Text></View>;
  }

  const isOwnProfile = user?.id === userId;

  const renderHeader = () => (
    <View>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{profile.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.profileSection}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>{profile.full_name?.charAt(0)}</Text>
          </View>
        )}
        
        <Text style={styles.nameText}>{profile.full_name}</Text>
        <Text style={styles.usernameText}>@{profile.username}</Text>
        {profile.bio && <Text style={styles.bioText}>{profile.bio}</Text>}

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{userPosts.length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {isBlocked && (
          <View style={styles.blockedBanner}>
            <Ionicons name="ban" size={16} color="#e0245e" />
            <Text style={styles.blockedBannerText}>You blocked this user</Text>
          </View>
        )}

        {!isOwnProfile && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.followButton, isFollowing && styles.followingButton, isBlocked && styles.disabledButton]} 
              onPress={toggleFollow}
              disabled={isBlocked}
            >
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.messageButton, isBlocked && styles.disabledButton]} 
              onPress={startConversation}
              disabled={isBlocked}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#1DA1F2" />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>

            {/* Block বাটন - Follow/Message এর পাশে */}
            <TouchableOpacity 
              style={[styles.blockButton, isBlocked && styles.blockedButton]} 
              onPress={toggleBlock}
            >
              <Ionicons 
                name={isBlocked ? "lock-open-outline" : "ban-outline"} 
                size={20} 
                color={isBlocked ? "#fff" : "#e0245e"} 
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.postsHeader}>
        <Text style={styles.postsHeaderTitle}>Posts</Text>
      </View>
    </View>
  );

  const renderPost = ({ item }: { item: any }) => {
    const likesArray = item.post_likes || [];
    const commentsArray = item.comments || [];
    const likeCount = likesArray.length;
    const commentCount = commentsArray.length;
    const isLiked = likesArray.some((like: any) => like.user_id === user?.id);

    return (
      <View style={styles.postItem}>
        <Text style={styles.postContent}>{item.content}</Text>
        {item.image_url && (
          <TouchableOpacity onPress={() => setSelectedImage(item.image_url)}>
            <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
          </TouchableOpacity>
        )}
        
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => toggleLike(item)}>
            <Ionicons 
              name={isLiked ? 'heart' : 'heart-outline'} 
              size={22} 
              color={isLiked ? '#e0245e' : '#666'} 
            />
            <Text style={[styles.actionText, isLiked && styles.likedText]}>
              {likeCount > 0 ? likeCount : 'Like'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
          >
            <Ionicons name="chatbubble-outline" size={22} color="#666" />
            <Text style={styles.actionText}>
              {commentCount > 0 ? commentCount : 'Comment'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.postDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={userPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyPosts}>
            <Ionicons name="document-text-outline" size={40} color="#ccc" />
            <Text style={styles.emptyPostsText}>No posts yet.</Text>
          </View>
        }
      />

      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  listContainer: { paddingBottom: 20 },
  profileSection: { alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarPlaceholderText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  nameText: { fontSize: 22, fontWeight: 'bold' },
  usernameText: { fontSize: 15, color: '#666', marginTop: 3 },
  bioText: { fontSize: 14, textAlign: 'center', marginTop: 10, color: '#444', paddingHorizontal: 20 },
  
  statsContainer: { flexDirection: 'row', marginTop: 20, marginBottom: 15 },
  statItem: { alignItems: 'center', marginHorizontal: 20 },
  statNumber: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 13, color: '#666', marginTop: 2 },
  
  blockedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fde8e8', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginBottom: 10 },
  blockedBannerText: { color: '#e0245e', marginLeft: 5, fontWeight: 'bold', fontSize: 13 },

  actionButtons: { flexDirection: 'row', marginTop: 10, alignItems: 'center' },
  followButton: { backgroundColor: '#1DA1F2', paddingHorizontal: 30, paddingVertical: 10, borderRadius: 25 },
  followingButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#1DA1F2' },
  followButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  followingButtonText: { color: '#1DA1F2' },
  messageButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1DA1F2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, marginLeft: 10 },
  messageButtonText: { color: '#1DA1F2', fontWeight: 'bold', marginLeft: 5 },
  disabledButton: { opacity: 0.5 },
  
  // Block বাটন স্টাইল
  blockButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#e0245e', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  blockedButton: { backgroundColor: '#e0245e', borderColor: '#e0245e' },

  postsHeader: { paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  postsHeaderTitle: { fontSize: 16, fontWeight: 'bold' },
  
  postItem: { paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  postContent: { fontSize: 15, marginBottom: 8 },
  postImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 8, backgroundColor: '#eee' },
  postDate: { fontSize: 12, color: '#999', marginTop: 8 },
  
  postActions: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 5 },
  actionButton: { flexDirection: 'row', alignItems: 'center' },
  actionText: { marginLeft: 5, color: '#666', fontSize: 14 },
  likedText: { color: '#e0245e', fontWeight: 'bold' },
  
  emptyPosts: { alignItems: 'center', padding: 40 },
  emptyPostsText: { color: '#999', marginTop: 10 },
  
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: width, height: '80%' },
});
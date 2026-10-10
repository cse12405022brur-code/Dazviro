import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchNotifications();
    });
    return unsubscribe;
  }, [navigation]);

  async function fetchNotifications() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:actor_id (id, username, full_name, avatar_url)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleNotificationPress(item: any) {
    if (item.type === 'like' || item.type === 'comment') {
      navigation.navigate('PostDetail', { postId: item.reference_id });
    } else if (item.type === 'follow') {
      navigation.navigate('UserProfile', { userId: item.actor_id });
    } else if (item.type === 'message') {
      navigation.navigate('Chat', { 
        conversationId: item.reference_id, 
        otherUserId: item.actor_id, 
        otherUserName: item.actor?.full_name, 
        otherUserAvatar: item.actor?.avatar_url 
      });
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

  const getNotificationText = (item: any) => {
    const name = item.actor?.full_name || 'Someone';
    switch (item.type) {
      case 'like': return `${name} liked your post`;
      case 'comment': return `${name} commented on your post`;
      case 'follow': return `${name} started following you`;
      case 'message': return `${name} sent you a message`;
      default: return `${name} did something`;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return { name: 'heart', color: '#e0245e' };
      case 'comment': return { name: 'chatbubble', color: '#1DA1F2' };
      case 'follow': return { name: 'person-add', color: '#17bf63' };
      case 'message': return { name: 'mail', color: '#794bc4' };
      default: return { name: 'notifications', color: '#666' };
    }
  };

  const renderNotification = ({ item }: { item: any }) => {
    const icon = getNotificationIcon(item.type);

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon.name as any} size={20} color={icon.color} />
        </View>

        {item.actor?.avatar_url ? (
          <Image source={{ uri: item.actor.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>
              {item.actor?.full_name?.charAt(0) || '?'}
            </Text>
          </View>
        )}

        <View style={styles.notificationContent}>
          <Text style={styles.notificationText}>{getNotificationText(item)}</Text>
          
          {/* পোস্টের প্রিভিউ (লাইক/কমেন্ট হলে) */}
          {(item.type === 'like' || item.type === 'comment') && item.post_preview && (
            <View style={styles.postPreviewContainer}>
              <Text style={styles.postPreview} numberOfLines={1}>
                "{item.post_preview}{item.post_preview.length >= 50 ? '...' : ''}"
              </Text>
            </View>
          )}

          <Text style={styles.notificationTime}>{getTimeAgo(item.created_at)}</Text>
        </View>

        {!item.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DA1F2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            When someone likes, comments or follows you, you'll see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#666', marginTop: 15 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5, textAlign: 'center', paddingHorizontal: 20 },
  listContainer: { paddingBottom: 20 },
  notificationCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  unreadCard: { backgroundColor: '#e8f4fd' },
  iconContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarPlaceholderText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  notificationContent: { flex: 1 },
  notificationText: { fontSize: 14, color: '#333', lineHeight: 20 },
  postPreviewContainer: { backgroundColor: '#f5f5f5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginTop: 5 },
  postPreview: { fontSize: 13, color: '#555', fontStyle: 'italic' },
  notificationTime: { fontSize: 12, color: '#999', marginTop: 5 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1DA1F2' },
});
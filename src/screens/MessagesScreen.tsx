import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function MessagesScreen({ navigation }: any) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();

    // স্ক্রিনে ফোকাস আসলেই ডাটা রিফ্রেশ হবে (নতুন মেসেজ এলে আপডেট হবে)
    const unsubscribe = navigation.addListener('focus', () => {
      fetchConversations();
    });
    return unsubscribe;
  }, [navigation]);

  async function fetchConversations() {
    try {
      setLoading(true);

      // ১. আমার সব কথোপকথন আনো
      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`)
        .order('updated_at', { ascending: false });

      if (convError) throw convError;

      if (!convs || convs.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // ২. প্রতিটি কথোপকথনের জন্য অন্যান্য ইউজারের প্রোফাইল এবং শেষ মেসেজ আনো
      const formattedConvs = await Promise.all(
        convs.map(async (conv) => {
          const otherUserId = conv.user1_id === user?.id ? conv.user2_id : conv.user1_id;

          // অন্যান্য ইউজারের প্রোফাইল
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .eq('id', otherUserId)
            .single();

          // শেষ মেসেজ
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // আনরিড মেসেজ কাউন্ট (যেগুলো আমি পড়িনি)
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user?.id)
            .eq('is_read', false);

          return {
            ...conv,
            otherUser: profileData,
            lastMessage: lastMsg,
            unreadCount: unreadCount || 0,
          };
        })
      );

      // যে কথোপকথনে কোনো মেসেজ নেই, সেগুলো বাদ দাও
      const activeConvs = formattedConvs.filter((c) => c.lastMessage);
      setConversations(activeConvs);

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const renderConversation = ({ item }: { item: any }) => {
    const otherUser = item.otherUser;
    const isMyLastMessage = item.lastMessage?.sender_id === user?.id;

    return (
      <TouchableOpacity
        style={styles.convCard}
        onPress={() =>
          navigation.navigate('Chat', {
            conversationId: item.id,
            otherUserId: otherUser?.id,
            otherUserName: otherUser?.full_name,
            otherUserAvatar: otherUser?.avatar_url,
          })
        }
      >
        {otherUser?.avatar_url ? (
          <Image source={{ uri: otherUser.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>
              {otherUser?.full_name?.charAt(0) || '?'}
            </Text>
          </View>
        )}

        <View style={styles.convInfo}>
          <View style={styles.convHeader}>
            <Text style={styles.convName}>{otherUser?.full_name || 'Unknown'}</Text>
            <Text style={styles.convTime}>{formatTime(item.lastMessage?.created_at)}</Text>
          </View>
          <View style={styles.convFooter}>
            <Text
              style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadMessage]}
              numberOfLines={1}
            >
              {isMyLastMessage ? 'You: ' : ''}
              {item.lastMessage?.content}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Start a conversation from someone's profile.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#666', marginTop: 15 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5, textAlign: 'center' },
  listContainer: { paddingBottom: 20 },
  convCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 55, height: 55, borderRadius: 27.5 },
  avatarPlaceholder: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  convInfo: { flex: 1, marginLeft: 15 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  convName: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  convTime: { fontSize: 12, color: '#999' },
  convFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, color: '#666', flex: 1, marginRight: 10 },
  unreadMessage: { color: '#000', fontWeight: 'bold' },
  unreadBadge: { backgroundColor: '#1DA1F2', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
});
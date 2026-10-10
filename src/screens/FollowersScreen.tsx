import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function FollowersScreen({ route, navigation }: any) {
  const { userId, type } = route.params;
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('FollowersScreen loaded with userId:', userId, 'type:', type);
    fetchList();
  }, [userId, type]);

  async function fetchList() {
    try {
      setLoading(true);

      let userIds: string[] = [];

      // ধাপ ১: follows টেবিল থেকে আইডি নাও
      if (type === 'followers') {
        const { data, error } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', userId);
        
        if (error) {
          console.log('Error fetching follows:', error);
          throw error;
        }
        console.log('Raw follows data:', data);
        userIds = (data || []).map((item: any) => item.follower_id);
      } else {
        const { data, error } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);
        
        if (error) {
          console.log('Error fetching follows:', error);
          throw error;
        }
        console.log('Raw follows data:', data);
        userIds = (data || []).map((item: any) => item.following_id);
      }

      console.log('User IDs found:', userIds);

      if (userIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // ধাপ ২: profiles টেবিল থেকে ডাটা আনো
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) {
        console.log('Error fetching profiles:', profilesError);
        throw profilesError;
      }
      
      console.log('Profiles found:', profilesData);
      setUsers(profilesData || []);

    } catch (error: any) {
      console.log('Caught error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  const renderUser = ({ item }: { item: Profile }) => (
    <TouchableOpacity 
      style={styles.userCard} 
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
    >
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarPlaceholderText}>{item.full_name?.charAt(0) || '?'}</Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.fullName}>{item.full_name || 'Unknown User'}</Text>
        <Text style={styles.username}>@{item.username || 'unknown'}</Text>
        {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {type === 'followers' ? 'Followers' : 'Following'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DA1F2" />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>
            {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
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
  emptyText: { fontSize: 16, color: '#999', marginTop: 10 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  userCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  userInfo: { flex: 1, marginLeft: 15 },
  fullName: { fontSize: 16, fontWeight: 'bold' },
  username: { fontSize: 14, color: '#666', marginTop: 2 },
  bio: { fontSize: 13, color: '#999', marginTop: 2 },
});
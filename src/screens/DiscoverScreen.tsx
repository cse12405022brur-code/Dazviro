import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Profile } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function DiscoverScreen({ navigation }: any) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUsers();
    });
    return unsubscribe;
  }, [navigation]);

  async function fetchUsers() {
    try {
      setLoading(true);

      // প্রথমে বের কর আমি কাদের ব্লক করেছি
      const { data: blockedData } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', user?.id);

      const blockedIds = (blockedData || []).map((b: any) => b.blocked_id);

      // তারপর সব ইউজার আনো, নিজেকে এবং ব্লক করা ইউজারদের বাদ দিয়ে
      let query = supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id);

      if (blockedIds.length > 0) {
        // Supabase এর not in filter
        query = query.not('id', 'in', `(${blockedIds.map((id) => `"${id}"`).join(',')})`);
      }

      const { data, error } = await query.order('username', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase();
    return (
      u.username?.toLowerCase().includes(query) ||
      u.full_name?.toLowerCase().includes(query)
    );
  });

  const renderUser = ({ item }: { item: Profile }) => (
    <TouchableOpacity 
      style={styles.userCard} 
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
    >
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarPlaceholderText}>
            {item.full_name?.charAt(0) || '?'}
          </Text>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSubtitle}>Find your people on Dazviro</Text>
      </View>

      <TouchableOpacity 
        style={styles.communitiesButton}
        onPress={() => navigation.navigate('CommunitiesList')}
      >
        <Ionicons name="people" size={20} color="#1DA1F2" />
        <Text style={styles.communitiesButtonText}>Browse Communities</Text>
      </TouchableOpacity>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DA1F2" />
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No users found' : 'Start typing to search'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? `No results for "${searchQuery}"` : 'Search by username or full name.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
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
  header: { padding: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 5 },
  communitiesButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, marginBottom: 15, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1DA1F2' },
  communitiesButtonText: { color: '#1DA1F2', fontWeight: 'bold', marginLeft: 8 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 25, paddingHorizontal: 15, marginHorizontal: 20, marginBottom: 15, height: 45 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#666', marginTop: 15 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5, textAlign: 'center' },
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
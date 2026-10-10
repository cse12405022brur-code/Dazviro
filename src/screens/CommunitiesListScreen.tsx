import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function CommunitiesListScreen({ navigation }: any) {
  const { user } = useAuth();
  const [communities, setCommunities] = useState<any[]>([]);
  const [myCommunities, setMyCommunities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunities();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCommunities();
    });
    return unsubscribe;
  }, [navigation]);

  async function fetchCommunities() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('communities')
        .select(`
          *,
          profiles:owner_id (id, username, full_name, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommunities(data || []);

      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', user?.id);

      setMyCommunities((memberships || []).map((m: any) => m.community_id));

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function joinCommunity(communityId: string) {
    try {
      const { error } = await supabase
        .from('community_members')
        .insert({ community_id: communityId, user_id: user?.id });
      if (error) throw error;
      
      setMyCommunities([...myCommunities, communityId]);
      Alert.alert('Success', 'Joined community!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  const renderCommunity = ({ item }: { item: any }) => {
    const isMember = myCommunities.includes(item.id);
    const isOwner = item.owner_id === user?.id;

    return (
      <TouchableOpacity 
        style={styles.communityCard}
        onPress={() => navigation.navigate('CommunityDetail', { communityId: item.id })}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.communityImage} />
        ) : (
          <View style={styles.communityImagePlaceholder}>
            <Ionicons name="people" size={30} color="#fff" />
          </View>
        )}
        
        <View style={styles.communityInfo}>
          <Text style={styles.communityName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.communityDescription} numberOfLines={1}>
            {item.description || 'No description'}
          </Text>
          <View style={styles.communityMeta}>
            <Ionicons name="person-outline" size={12} color="#666" />
            <Text style={styles.communityMetaText}>
              Owned by @{item.profiles?.username}
            </Text>
            {item.is_private && (
              <>
                <Ionicons name="lock-closed" size={12} color="#666" style={{ marginLeft: 10 }} />
                <Text style={styles.communityMetaText}>Private</Text>
              </>
            )}
          </View>
        </View>

        {!isMember && !isOwner ? (
          <TouchableOpacity 
            style={styles.joinButton}
            onPress={() => joinCommunity(item.id)}
          >
            <Text style={styles.joinButtonText}>Join</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.memberBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#1DA1F2" />
          </View>
        )}
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
        <Text style={styles.headerTitle}>Communities</Text>
        <View style={{ width: 24 }} />
      </View>

      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateCommunity')}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.createButtonText}>Create New Community</Text>
      </TouchableOpacity>

      {communities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No communities yet</Text>
          <Text style={styles.emptySubtext}>Be the first to create one!</Text>
        </View>
      ) : (
        <FlatList
          data={communities}
          keyExtractor={(item) => item.id}
          renderItem={renderCommunity}
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
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5 },
  listContainer: { padding: 15 },
  createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1DA1F2', marginHorizontal: 20, marginTop: 15, marginBottom: 15, padding: 15, borderRadius: 10 },
  createButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  communityCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee', alignItems: 'center' },
  communityImage: { width: 60, height: 60, borderRadius: 30 },
  communityImagePlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center' },
  communityInfo: { flex: 1, marginLeft: 12 },
  communityName: { fontSize: 16, fontWeight: 'bold' },
  communityDescription: { fontSize: 13, color: '#666', marginTop: 3 },
  communityMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  communityMetaText: { fontSize: 11, color: '#666', marginLeft: 3 },
  joinButton: { backgroundColor: '#1DA1F2', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  joinButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  memberBadge: { padding: 5 },
});
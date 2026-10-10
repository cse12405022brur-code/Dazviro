import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function AdminModerationScreen({ navigation }: any) {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    fetchReports();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchReports();
    });
    return unsubscribe;
  }, [navigation, filter]);

  async function fetchReports() {
    try {
      setLoading(true);

      let query = supabase
        .from('reports')
        .select(`
          *,
          reporter:reporter_id (id, username, full_name, avatar_url),
          reported_user:reported_user_id (id, username, full_name, avatar_url),
          reported_post:reported_post_id (id, content, image_url, user_id),
          reported_community:reported_community_id (id, name)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('status', 'pending');
      }

      const { data, error } = await query;
      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  // রিপোর্ট ডিসমিস করা
  async function dismissReport(reportId: string) {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'dismissed' })
        .eq('id', reportId);
      if (error) throw error;
      setReports(reports.filter((r) => r.id !== reportId));
      Alert.alert('Success', 'Report dismissed.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  // পোস্ট ডিলিট করা
  async function deletePost(postId: string, reportId: string) {
    Alert.alert('Delete Post', 'Delete this reported post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error: postError } = await supabase
              .from('posts')
              .delete()
              .eq('id', postId);
            if (postError) throw postError;

            await supabase
              .from('reports')
              .update({ status: 'actioned' })
              .eq('id', reportId);

            setReports(reports.filter((r) => r.id !== reportId));
            Alert.alert('Success', 'Post deleted and report actioned.');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  }

  // ইউজার ব্যান করা
  async function banUser(userId: string, reportId: string) {
    Alert.alert('Ban User', 'Are you sure you want to ban this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ban',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error: banError } = await supabase
              .from('bans')
              .insert({ user_id: userId, reason: 'Violation of community guidelines', banned_by: user?.id });
            if (banError) throw banError;

            await supabase
              .from('reports')
              .update({ status: 'actioned' })
              .eq('id', reportId);

            setReports(reports.filter((r) => r.id !== reportId));
            Alert.alert('Success', 'User banned.');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  }

  const getReportTypeText = (report: any) => {
    if (report.reported_post_id) return 'Post';
    if (report.reported_user_id) return 'User';
    if (report.reported_comment_id) return 'Comment';
    if (report.reported_community_id) return 'Community';
    return 'Unknown';
  };

  const renderReport = ({ item }: { item: any }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportTypeBadge}>
          <Text style={styles.reportTypeText}>{getReportTypeText(item)}</Text>
        </View>
        <Text style={styles.reportTime}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      {/* রিপোর্টের কারণ */}
      <Text style={styles.reasonLabel}>Reason:</Text>
      <Text style={styles.reasonText}>{item.reason}</Text>
      {item.details && <Text style={styles.detailsText}>"{item.details}"</Text>}

      {/* রিপোর্ট করা হয়েছে যাকে */}
      <View style={styles.reportedContent}>
        {item.reported_post && (
          <>
            <Text style={styles.contentLabel}>Reported Post:</Text>
            <Text style={styles.contentText} numberOfLines={3}>
              {item.reported_post.content}
            </Text>
            {item.reported_post.image_url && (
              <Image source={{ uri: item.reported_post.image_url }} style={styles.reportedImage} />
            )}
          </>
        )}

        {item.reported_user && (
          <>
            <Text style={styles.contentLabel}>Reported User:</Text>
            <View style={styles.reportedUserRow}>
              {item.reported_user.avatar_url && (
                <Image source={{ uri: item.reported_user.avatar_url }} style={styles.reportedAvatar} />
              )}
              <Text style={styles.contentText}>
                {item.reported_user.full_name} (@{item.reported_user.username})
              </Text>
            </View>
          </>
        )}
      </View>

      {/* রিপোর্টার */}
      <Text style={styles.reporterText}>
        Reported by: {item.reporter?.full_name || 'Unknown'} (@{item.reporter?.username || 'unknown'})
      </Text>

      {/* অ্যাকশন বাটন */}
      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.dismissBtn]} 
          onPress={() => dismissReport(item.id)}
        >
          <Text style={styles.actionBtnText}>Dismiss</Text>
        </TouchableOpacity>

        {item.reported_post_id && (
          <TouchableOpacity 
            style={[styles.actionBtn, styles.deleteBtn]} 
            onPress={() => deletePost(item.reported_post_id, item.id)}
          >
            <Text style={styles.actionBtnText}>Delete Post</Text>
          </TouchableOpacity>
        )}

        {item.reported_user_id && (
          <TouchableOpacity 
            style={[styles.actionBtn, styles.banBtn]} 
            onPress={() => banUser(item.reported_user_id, item.id)}
          >
            <Text style={styles.actionBtnText}>Ban User</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moderation</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter Tab */}
      <View style={styles.filterRow}>
        <TouchableOpacity 
          style={[styles.filterBtn, filter === 'pending' && styles.filterBtnActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All Reports
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DA1F2" />
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="shield-checkmark-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No pending reports</Text>
          <Text style={styles.emptySubtext}>All reports have been reviewed.</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  filterRow: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  filterBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8, marginHorizontal: 5, backgroundColor: '#f0f0f0' },
  filterBtnActive: { backgroundColor: '#1DA1F2' },
  filterText: { color: '#666', fontWeight: 'bold' },
  filterTextActive: { color: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#666', marginTop: 15 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5, textAlign: 'center' },
  listContainer: { padding: 10 },
  reportCard: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reportTypeBadge: { backgroundColor: '#1DA1F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  reportTypeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  reportTime: { fontSize: 12, color: '#999' },
  reasonLabel: { fontSize: 13, fontWeight: 'bold', color: '#333', marginTop: 5 },
  reasonText: { fontSize: 14, color: '#e0245e', fontWeight: 'bold', marginTop: 2 },
  detailsText: { fontSize: 13, color: '#666', fontStyle: 'italic', marginTop: 5 },
  reportedContent: { backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8, marginTop: 10 },
  contentLabel: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 5 },
  contentText: { fontSize: 14, color: '#333' },
  reportedImage: { width: '100%', height: 150, borderRadius: 8, marginTop: 8 },
  reportedUserRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  reportedAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 8 },
  reporterText: { fontSize: 12, color: '#999', marginTop: 10, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', marginTop: 15, justifyContent: 'space-between' },
  actionBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 3 },
  dismissBtn: { backgroundColor: '#999' },
  deleteBtn: { backgroundColor: '#f39c12' },
  banBtn: { backgroundColor: '#e0245e' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
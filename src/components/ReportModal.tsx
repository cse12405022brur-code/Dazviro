import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportType: 'post' | 'user' | 'comment' | 'community';
  targetId: string;
  targetName?: string;
}

const REASONS = [
  { key: 'spam', label: 'Spam or misleading' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate', label: 'Hate speech' },
  { key: 'violence', label: 'Violence or dangerous content' },
  { key: 'nudity', label: 'Nudity or sexual content' },
  { key: 'false_info', label: 'False information' },
  { key: 'other', label: 'Other' },
];

export default function ReportModal({ visible, onClose, reportType, targetId, targetName }: ReportModalProps) {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submitReport() {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason');
      return;
    }

    setSubmitting(true);

    try {
      const reportData: any = {
        reporter_id: user?.id,
        reason: selectedReason,
        details: details.trim() || null,
      };

      if (reportType === 'post') reportData.reported_post_id = targetId;
      else if (reportType === 'user') reportData.reported_user_id = targetId;
      else if (reportType === 'comment') reportData.reported_comment_id = targetId;
      else if (reportType === 'community') reportData.reported_community_id = targetId;

      const { error } = await supabase.from('reports').insert(reportData);
      if (error) throw error;

      Alert.alert('Report Submitted', 'Thank you for helping keep Dazviro safe. We will review this report.');
      setSelectedReason('');
      setDetails('');
      onClose();

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Report {reportType}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {targetName && (
            <Text style={styles.subtitle}>
              Reporting: <Text style={styles.targetName}>{targetName}</Text>
            </Text>
          )}

          <Text style={styles.label}>Select a reason:</Text>

          {REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.key}
              style={styles.reasonRow}
              onPress={() => setSelectedReason(reason.key)}
            >
              <View style={[styles.radioOuter, selectedReason === reason.key && styles.radioOuterSelected]}>
                {selectedReason === reason.key && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.reasonText}>{reason.label}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.label}>Additional details (optional):</Text>
          <TextInput
            style={styles.detailsInput}
            placeholder="Describe the issue..."
            value={details}
            onChangeText={setDetails}
            multiline
            numberOfLines={3}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitButton, submitting && styles.disabledButton]} 
              onPress={submitReport}
              disabled={submitting}
            >
              <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Report'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 20, fontWeight: 'bold', textTransform: 'capitalize' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 15 },
  targetName: { fontWeight: 'bold', color: '#000' },
  label: { fontSize: 14, fontWeight: 'bold', marginTop: 10, marginBottom: 8, color: '#333' },
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioOuterSelected: { borderColor: '#1DA1F2' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1DA1F2' },
  reasonText: { fontSize: 15, color: '#333' },
  detailsInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, height: 80, textAlignVertical: 'top', fontSize: 14 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  cancelButton: { flex: 1, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', marginRight: 10, alignItems: 'center' },
  cancelText: { color: '#666', fontWeight: 'bold', fontSize: 15 },
  submitButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#e0245e', marginLeft: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  disabledButton: { backgroundColor: '#f5a3b8' },
});
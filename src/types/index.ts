// src/types/index.ts

// ১. ইউজার প্রোফাইলের টাইপ
export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

// ২. পোস্টের টাইপ
export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  // যখন আমরা ডাটাবেস থেকে পোস্ট আনবো, তখন ইউজারের নামও সাথে আনবো
  profiles?: Profile; 
}

// ৩. মেসেজের টাইপ
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
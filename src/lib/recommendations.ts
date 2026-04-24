import { collection, addDoc, getDocs, query, where, orderBy, doc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface Recommendation {
  id?: string;
  authorId: string;
  targetUserId: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt: Date;
}

const COLLECTION_NAME = 'recommendations';

// おすすめを投稿する
export const createRecommendation = async (data: Omit<Recommendation, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding recommendation:', error);
    throw error;
  }
};

// 特定のユーザーが「書いた」おすすめを取得する
export const getRecommendationsByAuthor = async (authorId: string): Promise<Recommendation[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('authorId', '==', authorId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    } as Recommendation));
  } catch (error) {
    console.error('Error getting recommendations by author:', error);
    return [];
  }
};

// 特定のユーザーが「貰った（おすすめされた）」投稿を取得する
export const getRecommendationsForUser = async (targetUserId: string): Promise<Recommendation[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('targetUserId', '==', targetUserId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    } as Recommendation));
  } catch (error) {
    console.error('Error getting recommendations for user:', error);
    return [];
  }
};

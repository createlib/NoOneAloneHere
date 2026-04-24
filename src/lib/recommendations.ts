import { collection, addDoc, getDocs, query, where, orderBy, doc, Timestamp, getDoc } from 'firebase/firestore';
import { db, APP_ID } from './firebase';

export interface Recommendation {
  id?: string;
  authorId: string;
  targetUserId: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt: Date;
}

// 共通のコレクション参照取得関数
const getRecommendationsCollection = () => collection(db, 'artifacts', APP_ID, 'public', 'data', 'recommendations');

// おすすめを投稿する
export const createRecommendation = async (data: Omit<Recommendation, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(getRecommendationsCollection(), {
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
      getRecommendationsCollection(),
      where('authorId', '==', authorId)
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    } as Recommendation));
    // orderByをクエリで行うとインデックスが必要になるため、ローカルでソート
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Error getting recommendations by author:', error);
    return [];
  }
};

// 特定のユーザーが「貰った（おすすめされた）」投稿を取得する
export const getRecommendationsForUser = async (targetUserId: string): Promise<Recommendation[]> => {
  try {
    const q = query(
      getRecommendationsCollection(),
      where('targetUserId', '==', targetUserId)
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    } as Recommendation));
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Error getting recommendations for user:', error);
    return [];
  }
};

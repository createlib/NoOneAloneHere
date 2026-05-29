'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage, APP_ID } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, where, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AppShell from '@/components/AppShell';
import EventDetailSheet, { formatText } from '@/components/EventDetailSheet';
import { Anchor, Compass, Hourglass, Ship, User, Image as ImageIcon, Check, MapPin, List, Briefcase, Sliders, X, CirclePlus, Tags, Lock, Building, DollarSign, Calendar, Search, Share2, Loader2 } from 'lucide-react';
import Script from 'next/script';

const PRESET_TAGS = ["交流会", "勉強会", "スポーツ", "音楽", "アート", "グルメ", "アウトドア", "ビジネス", "初心者歓迎", "オンライン"];

type EventData = {
    id: string;
    title: string;
    price: number | string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    description: string;
    tags: string[];
    thumbnailUrl?: string;
    imageUrls?: string[];
    organizerId: string;
    organizerName: string;
    isParticipantsPublic: boolean;
    isOnline: boolean;
    locationName?: string;
    onlineUrl?: string;
    lat?: number;
    lng?: number;
    participantCount: number;
    participants?: string[];
    endTimestamp?: string;
    visibilityMode?: string;
    allowedUsers?: string[];
    allowedUserDetails?: {uid: string, name: string}[];
    chatJoinMode?: 'auto' | 'approval';
    createdAt?: any;
    updatedAt?: any;
};

type JobData = {
    id: string;
    title: string;
    listingType?: string;
    type: string;
    category: string;
    desc: string;
    rewardType: string;
    rewardAmount: string;
    period: string;
    workStyle: string;
    location: string;
    skills: string;
    deadline: string;
    flow: string;
    company: string;
    url: string;
    organizerId: string;
    organizerName: string;
    organizerAvatar?: string;
    lat?: number;
    lng?: number;
    visibilityMode?: string;
    allowedUsers?: string[];
    allowedUserDetails?: {uid: string, name: string}[];
    createdAt?: any;
    updatedAt?: any;
};



function EventsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const [userData, setUserData] = useState<any>(null);

    const [viewMode, setViewMode] = useState<'map' | 'list-events' | 'list-jobs'>('list-events');
    const [isLoading, setIsLoading] = useState(true);
    const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
    
    const [allEvents, setAllEvents] = useState<EventData[]>([]);
    const [allJobs, setAllJobs] = useState<JobData[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<EventData[]>([]);
    const [filteredJobs, setFilteredJobs] = useState<JobData[]>([]);

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
    const [refreshPartsKey, setRefreshPartsKey] = useState(0);
    const [theaterMenuOpen, setTheaterMenuOpen] = useState(false);
    const [eventJoinStatusMap, setEventJoinStatusMap] = useState<Record<string, boolean>>({});

    const [myFollowingSet, setMyFollowingSet] = useState<Set<string>>(new Set());
    const [myFollowersSet, setMyFollowersSet] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user || user.isAnonymous) return;
        const checkJoins = async () => {
            const myJoinColl = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'participating_events');
            const snapJoin = await getDocs(myJoinColl);
            const statusMap: Record<string, boolean> = {};
            snapJoin.forEach(d => { statusMap[d.id] = true; });
            setEventJoinStatusMap(statusMap);
        };
        const checkRelationships = async () => {
            try {
                const followingSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'following'));
                const followingIds = new Set(followingSnap.docs.map(d => d.id));
                setMyFollowingSet(followingIds);
                
                const followersSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'followers'));
                const followersIds = new Set(followersSnap.docs.map(d => d.id));
                setMyFollowersSet(followersIds);
            } catch(e) { console.error('Error fetching relationships:', e); }
        };
        checkJoins();
        checkRelationships();
    }, [user]);

    // Filter states
    const [eventDateFilter, setEventDateFilter] = useState('all');
    const [eventFormatFilter, setEventFormatFilter] = useState('all');
    const [eventPriceFilter, setEventPriceFilter] = useState('all');
    const [eventTagsFilter, setEventTagsFilter] = useState<Set<string>>(new Set());

    const [jobTypeFilter, setJobTypeFilter] = useState('');
    const [jobCategoryFilter, setJobCategoryFilter] = useState('');
    const [jobWorkstyleFilter, setJobWorkstyleFilter] = useState('');
    const [jobRewardFilter, setJobRewardFilter] = useState('');

    const [mapSearchText, setMapSearchText] = useState('');

    // Modals and Sheets State
    const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
    const [selectedJob, setSelectedJob] = useState<JobData | null>(null);
    
    // User Search State for Visibility
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);

    const searchUsers = async (q: string) => {
        if (!q.trim()) { setUserSearchResults([]); return; }
        setIsSearchingUsers(true);
        try {
            const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
            const snap = await getDocs(usersRef);
            const lowerQ = q.toLowerCase();
            const results = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter((u: any) => 
                (u.name && u.name.toLowerCase().includes(lowerQ)) || 
                (u.userId && u.userId.toLowerCase().includes(lowerQ))
            ).slice(0, 20);
            setUserSearchResults(results);
        } catch(e) { console.error(e); }
        setIsSearchingUsers(false);
    };
    
    // Create/Edit Event State
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [eventFormData, setEventFormData] = useState({
        title: '', price: '0', startDate: '', startTime: '', endDate: '', endTime: '', desc: '',
        isOnline: false, onlineTool: '', onlineUrl: '', locationName: '', locationQuery: '', participantPublic: true,
        visibilityMode: 'public', allowedUsers: [] as string[], allowedUserDetails: [] as {uid: string, name: string}[],
        chatJoinMode: 'auto'
    });
    const [eventFiles, setEventFiles] = useState<{file: File, preview: string}[]>([]);
    const [eventOldImages, setEventOldImages] = useState<string[]>([]);
    const [eventSelectedTags, setEventSelectedTags] = useState<Set<string>>(new Set());
    const [eventCustomTags, setEventCustomTags] = useState('');
    const [submittingEvent, setSubmittingEvent] = useState(false);

    // Create/Edit Job State
    const [jobModalOpen, setJobModalOpen] = useState(false);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);
    const [jobFormData, setJobFormData] = useState({
        title: '', listingType: 'formal_job', type: '業務委託', category: 'デザイン', desc: '', rewardType: '固定報酬', rewardAmount: '',
        period: '単発', workStyle: 'フルリモート', locationQuery: '', locationName: '', skills: '', deadline: '',
        flow: '面談1回', company: '', url: '', visibilityMode: 'public', allowedUsers: [] as string[], allowedUserDetails: [] as {uid: string, name: string}[]
    });
    const [submittingJob, setSubmittingJob] = useState(false);

    // Map Adjust State
    const [adjustMode, setAdjustMode] = useState<'event' | 'job' | null>(null);
    const [adjustCoords, setAdjustCoords] = useState<{lat: number, lng: number} | null>(null);
    const tempMarkerRef = useRef<any>(null);

    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMap = useRef<any>(null);
    const markersRef = useRef<any[]>([]);

    const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setUserLocation(loc);
                    if (leafletMap.current) {
                        leafletMap.current.setView([loc.lat, loc.lng], 16);
                    }
                },
                (err) => console.log("Location access denied or error")
            );
        }
    }, []);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };



    const searchLocation = async (type: 'event' | 'job') => {
        const queryStr = type === 'event' ? eventFormData.locationQuery : jobFormData.locationQuery;
        if (!queryStr) return alert('検索キーワードを入力してください');
        
        const applyLocation = (lat: number, lng: number, locName: string) => {
            setAdjustCoords({ lat, lng });
            if (type === 'event') {
                setEventFormData(prev => ({...prev, locationName: locName}));
                setEventModalOpen(false);
            } else {
                setJobFormData(prev => ({...prev, locationName: locName}));
                setJobModalOpen(false);
            }
            setAdjustMode(type);
            setViewMode('map');
            alert('地図を移動しました。赤色のピンをドラッグして正確な位置に微調整してください。');
        };

        try {
            // 国土地理院 API (msearch.gsi.go.jp)
            const res = await fetch(`https://msearch.gsi.go.jp/address/search?q=${encodeURIComponent(queryStr)}`);
            if (res.ok) {
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    if (Array.isArray(data) && data.length > 0) {
                        const first = data[0].geometry.coordinates;
                        applyLocation(first[1], first[0], data[0].properties.title);
                        return; // 成功したら終了
                    }
                } catch(e) {
                    console.warn('GSI parse error', e);
                }
            }
        } catch(e) {
            console.warn('GSI fetch error', e);
        }

        // フォールバック: OSM Nominatim API
        try {
            const resOsm = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}`, {
                headers: { 'Accept-Language': 'ja' }
            });
            if (resOsm.ok) {
                const dataOsm = await resOsm.json();
                if (Array.isArray(dataOsm) && dataOsm.length > 0) {
                    const firstOsm = dataOsm[0];
                    const locNameOsm = firstOsm.display_name.split(',')[0];
                    applyLocation(parseFloat(firstOsm.lat), parseFloat(firstOsm.lon), locNameOsm);
                    return; // 成功したら終了
                }
            }
        } catch(e) {
            console.warn('Osm Nominatim fetch error', e);
        }

        alert('見つかりませんでした。別のキーワードで試してください。');
    };

    const shareItem = (item: EventData | JobData, type: 'event' | 'job') => {
        const url = `${window.location.origin}/events?${type}Id=${item.id}`;
        const registerUrl = `${window.location.origin}/register?ref=${userData?.userId || user?.uid || ''}`;
        const inviterName = userData ? (userData.name || userData.userId) : 'ユーザー';
        const title = item.title || '無題';
        let rawDesc = (type === 'event' ? (item as EventData).description : (item as JobData).desc) || '';
        
        let text = '';
        if (type === 'event') {
            let shortDesc = rawDesc.substring(0, 200);
            if (rawDesc.length > 200) shortDesc += '…';

            const ev = item as EventData;
            const loc = ev.isOnline ? (ev.locationName || 'オンライン') : (ev.locationName || '未設定');
            const price = Number(ev.price || 0) > 0 ? `¥${Number(ev.price).toLocaleString()}` : '無料';
            
            const dateStr = (ev.startDate === ev.endDate) 
                ? `${ev.startDate || ''} ${ev.startTime || ''} 〜 ${ev.endTime || ''}`
                : `${ev.startDate || ''} ${ev.startTime || ''} 〜 ${ev.endDate || ''} ${ev.endTime || ''}`;

            text = `${inviterName}さんからイベント招待が届きました。
■イベントタイトル
　${title}
■日時
　${dateStr.trim()}
■場所
　${loc}
■参加費
　${price}
■イベント概要
${shortDesc}

⇩以降は詳細へ⇩
${url}

―――
⇩NOAHに参加していない方は、ユーザー登録をしてから参加ボタンを押してください。⇩
${registerUrl}`;
        } else {
            let desc = rawDesc;
            if (desc.length > 80) desc = desc.substring(0, 80) + '...以降は詳細へ';
            text = `${inviterName}さんが仕事・依頼の募集を開始しました。\n■${title}\n■${desc}\n${url}\n\n―――\n⇩NOAHに参加していない方は、ユーザー登録をしてから詳細をご確認ください。⇩\n${registerUrl}`;
        }
        
        navigator.clipboard.writeText(text).then(() => alert('共有リンクと紹介文をコピーしました！')).catch(() => alert('コピーに失敗しました。'));
    };

    useEffect(() => {
        if (user) {
            getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'))
                .then(snap => {
                    if (snap.exists()) setUserData(snap.data());
                })
                .catch(console.error);
        }
        loadData();
    }, [user]);

    useEffect(() => {
        const targetEventId = searchParams?.get('eventId');
        const targetJobId = searchParams?.get('jobId');
        const editEventId = searchParams?.get('editEventId');

        if (editEventId && allEvents.length > 0) {
            const ev = allEvents.find(e => e.id === editEventId);
            if (ev && !eventModalOpen) {
                setEventFormData({
                    title: ev.title || '',
                    price: String(ev.price) || '0',
                    startDate: ev.startDate || '',
                    startTime: ev.startTime || '',
                    endDate: ev.endDate || '',
                    endTime: ev.endTime || '',
                    desc: ev.description || '',
                    isOnline: !!ev.isOnline,
                    onlineTool: ev.onlineUrl ? 'other' : '',
                    onlineUrl: ev.onlineUrl || '',
                    locationName: ev.locationName || '',
                    locationQuery: ev.locationName || '',
                    participantPublic: ev.isParticipantsPublic ?? true,
                    visibilityMode: ev.visibilityMode || 'public',
                    allowedUsers: ev.allowedUsers || [],
                    allowedUserDetails: ev.allowedUserDetails || [],
                    chatJoinMode: ev.chatJoinMode || 'auto'
                });
                setEditingEventId(editEventId);
                setEventSelectedTags(new Set(ev.tags || []));
                setEventOldImages(ev.imageUrls && ev.imageUrls.length > 0 ? ev.imageUrls : (ev.thumbnailUrl ? [ev.thumbnailUrl] : []));
                setEventFiles([]);
                setEventModalOpen(true);
                window.history.replaceState(null, '', '/events');
            }
        } else if (targetEventId && allEvents.length > 0 && !selectedEvent) {
            const ev = allEvents.find(e => e.id === targetEventId);
            if (ev) { setViewMode('list-events'); setSelectedEvent(ev); }
            window.history.replaceState(null, '', '/events');
        } else if (targetJobId && allJobs.length > 0 && !selectedJob) {
            const j = allJobs.find(x => x.id === targetJobId);
            if (j) { setViewMode('list-jobs'); setSelectedJob(j); }
            window.history.replaceState(null, '', '/events');
        }
    }, [searchParams, allEvents, allJobs]);

    useEffect(() => {
        filterData();
    }, [allEvents, allJobs, mapSearchText, eventDateFilter, eventFormatFilter, eventPriceFilter, eventTagsFilter, jobTypeFilter, jobCategoryFilter, jobWorkstyleFilter, jobRewardFilter, userLocation, user, myFollowingSet, myFollowersSet]);

    useEffect(() => {
        if (viewMode === 'map' && leafletMap.current) {
            setTimeout(() => {
                leafletMap.current.invalidateSize();
            }, 100);
        }
    }, [viewMode]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load Events
            const eventsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'events');
            const eventsSnap = await getDocs(eventsRef);
            let eList: EventData[] = [];
            eventsSnap.forEach(d => eList.push({ id: d.id, ...d.data() } as EventData));
            
            // Sort events by date descending temporarily (will do nearest soon)
            eList.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
            setAllEvents(eList);

            // Load Jobs
            const jobsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'jobs');
            const jobsSnap = await getDocs(jobsRef);
            let jList: JobData[] = [];
            jobsSnap.forEach(d => jList.push({ id: d.id, ...d.data() } as JobData));
            jList.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
            setAllJobs(jList);

        } catch (error) {
            console.error('Data load error:', error);
        }
        setIsLoading(false);
    };

    const filterData = () => {
        const queryText = (mapSearchText || "").toLowerCase();

        let evList = allEvents.filter(e => {
            if (queryText && 
                !((e.title?.toLowerCase().includes(queryText)) || 
                  (e.description?.toLowerCase().includes(queryText)) || 
                  (e.locationName?.toLowerCase().includes(queryText)))) {
                return false;
            }
            if (eventPriceFilter === 'free' && Number(e.price) > 0) return false;
            if (eventPriceFilter === 'paid' && Number(e.price) <= 0) return false;
            if (eventFormatFilter === 'offline' && e.isOnline) return false;
            if (eventFormatFilter === 'online' && !e.isOnline) return false;

            // 過去イベントを常に除外（終了時刻ベース）
            if (e.endTimestamp) {
                if (new Date(e.endTimestamp) < new Date()) return false;
            } else if (e.endDate && e.endTime) {
                if (new Date(`${e.endDate}T${e.endTime}`) < new Date()) return false;
            }

            // 開催時期フィルター（startDate基準）
            if (eventDateFilter !== 'all') {
                const now = new Date();
                let startDt: Date | null = null;
                if (e.startDate && e.startTime) startDt = new Date(`${e.startDate}T${e.startTime}`);
                else if (e.startDate) startDt = new Date(`${e.startDate}T00:00:00`);

                if (!startDt || isNaN(startDt.getTime())) return false;

                const diffMs = startDt.getTime() - now.getTime();
                if (eventDateFilter === 'today') {
                    if (startDt.toDateString() !== now.toDateString()) return false;
                } else if (eventDateFilter === 'week') {
                    if (diffMs < 0 || diffMs > 7 * 24 * 60 * 60 * 1000) return false;
                } else if (eventDateFilter === 'month') {
                    if (diffMs < 0 || diffMs > 30 * 24 * 60 * 60 * 1000) return false;
                }
            }

            if (eventTagsFilter.size > 0) {
                // タグ一致チェック：「オンライン」タグはisOnlineフラグも考慮
                const hasTag = e.tags?.some((t: string) => eventTagsFilter.has(t)) ||
                    (eventTagsFilter.has('オンライン') && e.isOnline);
                if (!hasTag) return false;
            }
            
            // Visibility logic
            if (e.organizerId !== user?.uid && e.organizerId !== 'admin') {
                let canView = false;
                if (e.allowedUsers?.includes(user?.uid || '')) {
                    canView = true;
                } else {
                    const vMode = e.visibilityMode || 'public';
                    if (vMode === 'public') {
                        canView = true;
                    } else if (user && !user.isAnonymous) {
                        if (vMode === 'followers' && myFollowingSet.has(e.organizerId)) canView = true;
                        if (vMode === 'following' && myFollowersSet.has(e.organizerId)) canView = true;
                        if (vMode === 'mutual' && myFollowingSet.has(e.organizerId) && myFollowersSet.has(e.organizerId)) canView = true;
                    }
                }
                if (!canView) return false;
            }
            
            return true;
        });

        if (userLocation) {
            evList.forEach((e: any) => {
                if (e.lat && e.lng) e._distance = calculateDistance(userLocation.lat, userLocation.lng, e.lat, e.lng);
                else e._distance = 999999;
            });
            evList.sort((a: any, b: any) => a._distance - b._distance);
        }

        let jList = allJobs.filter(j => {
            if (queryText && 
                !((j.title?.toLowerCase().includes(queryText)) || 
                  (j.desc?.toLowerCase().includes(queryText)) ||
                  (j.company?.toLowerCase().includes(queryText)))) {
                return false;
            }
            if (jobTypeFilter) {
                const lType = j.listingType || 'formal_job';
                if (lType !== jobTypeFilter) return false;
            }
            if (jobCategoryFilter && j.category !== jobCategoryFilter) return false;
            if (jobWorkstyleFilter && j.workStyle !== jobWorkstyleFilter) return false;
            if (jobRewardFilter && j.rewardType !== jobRewardFilter) return false;

            // Visibility logic
            if (j.organizerId !== user?.uid && j.organizerId !== 'admin') {
                let canView = false;
                if (j.allowedUsers?.includes(user?.uid || '')) {
                    canView = true;
                } else {
                    const vMode = j.visibilityMode || 'public';
                    if (vMode === 'public') {
                        canView = true;
                    } else if (user && !user.isAnonymous) {
                        if (vMode === 'followers' && myFollowingSet.has(j.organizerId)) canView = true;
                        if (vMode === 'following' && myFollowersSet.has(j.organizerId)) canView = true;
                        if (vMode === 'mutual' && myFollowingSet.has(j.organizerId) && myFollowersSet.has(j.organizerId)) canView = true;
                    }
                }
                if (!canView) return false;
            }

            return true;
        });

        setFilteredEvents(evList);
        setFilteredJobs(jList);
        updateMapMarkers(evList, jList);
    };

    const updateMapMarkers = (evts: EventData[], jobs: JobData[]) => {
        if (!leafletMap.current || typeof window === 'undefined' || !(window as any).L || adjustMode !== null) return;
        const L = (window as any).L;

        markersRef.current.forEach(m => leafletMap.current.removeLayer(m));
        markersRef.current = [];

        const redIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });

        const blueIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });

        evts.forEach(e => {
            if (e.lat && e.lng) {
                const marker = L.marker([e.lat, e.lng], { icon: redIcon }).addTo(leafletMap.current);
                marker.bindPopup(`<div class="font-bold text-sm tracking-widest cursor-pointer" onclick="window.showEventSheetById('${e.id}')">${e.title}</div><div class="text-[10px] text-brand-500 mt-1">イベント</div>`);
                markersRef.current.push(marker);
            }
        });

        jobs.forEach(j => {
            if (j.lat && j.lng) {
                const marker = L.marker([j.lat, j.lng], { icon: blueIcon }).addTo(leafletMap.current);
                marker.bindPopup(`<div class="font-bold text-sm tracking-widest cursor-pointer" onclick="window.showJobSheetById('${j.id}')">${j.title}</div><div class="text-[10px] text-blue-500 mt-1">仕事・依頼</div>`);
                markersRef.current.push(marker);
            }
        });
    };

    // Make global functions for Leaflet popups
    useEffect(() => {
        (window as any).showEventSheetById = (id: string) => {
            const ev = allEvents.find(e => e.id === id);
            if (ev) setSelectedEvent(ev);
        };
        (window as any).showJobSheetById = (id: string) => {
            const j = allJobs.find(x => x.id === id);
            if (j) setSelectedJob(j);
        };
        return () => {
            delete (window as any).showEventSheetById;
            delete (window as any).showJobSheetById;
        };
    }, [allEvents, allJobs]);

    const initMap = async () => {
        if (typeof window !== 'undefined' && mapRef.current && !leafletMap.current) {
            const L = (window as any).L;
            if (L) {
                leafletMap.current = L.map(mapRef.current).setView([35.681236, 139.767125], 12);
                L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                    attribution: '&copy; Google'
                }).addTo(leafletMap.current);
                updateMapMarkers(filteredEvents, filteredJobs);
            }
        }
    };

    const toggleEventTagFilter = (tag: string) => {
        const newSet = new Set(eventTagsFilter);
        if (newSet.has(tag)) newSet.delete(tag);
        else newSet.add(tag);
        setEventTagsFilter(newSet);
    };

    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => {
            initMap();
        };
        document.head.appendChild(script);

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);

        return () => {
            leafletMap.current?.remove();
        };
    }, []);

    // -------- Map Adjust & Modal Prep --------
    useEffect(() => {
        if (!leafletMap.current) return;
        const L = (window as any).L;
        if (!L) return;

        if (adjustMode !== null) {
            markersRef.current.forEach(m => leafletMap.current.removeLayer(m));
            if (tempMarkerRef.current) leafletMap.current.removeLayer(tempMarkerRef.current);

            const icon = new L.Icon({
                iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${adjustMode === 'event' ? 'red' : 'blue'}.png`,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41]
            });

            const center = leafletMap.current.getCenter();
            const startCoords = adjustCoords || { lat: center.lat, lng: center.lng };
            if (!adjustCoords) setAdjustCoords(startCoords);

            tempMarkerRef.current = L.marker([startCoords.lat, startCoords.lng], { draggable: true, icon }).addTo(leafletMap.current);
            tempMarkerRef.current.on('dragend', (e: any) => {
                const pos = e.target.getLatLng();
                setAdjustCoords({ lat: pos.lat, lng: pos.lng });
            });
            leafletMap.current.setView([startCoords.lat, startCoords.lng]);
        } else {
            if (tempMarkerRef.current) {
                leafletMap.current.removeLayer(tempMarkerRef.current);
                tempMarkerRef.current = null;
            }
            updateMapMarkers(filteredEvents, filteredJobs);
        }
    }, [adjustMode]);

    const openEventModal = (editId?: string) => {
        setIsCreateMenuOpen(false);
        setUserSearchQuery('');
        setUserSearchResults([]);
        if (editId) {
            const ev = allEvents.find(e => e.id === editId);
            if (ev) {
                setEditingEventId(editId);
                setEventFormData({
                    title: ev.title, price: ev.price.toString(), startDate: ev.startDate || '',
                    startTime: ev.startTime || '', endDate: ev.endDate || '', endTime: ev.endTime || '', desc: ev.description || '',
                    isOnline: !!ev.isOnline, onlineTool: ev.locationName?.replace('オンライン (', '')?.replace(')', '') || '',
                    onlineUrl: ev.onlineUrl || '', locationName: ev.locationName || '', locationQuery: '', participantPublic: ev.isParticipantsPublic !== false,
                    visibilityMode: ev.visibilityMode || 'public', allowedUsers: ev.allowedUsers || [], allowedUserDetails: ev.allowedUserDetails || [],
                    chatJoinMode: ev.chatJoinMode || 'auto'
                });
                setEventSelectedTags(new Set(ev.tags || []));
                setEventOldImages(ev.imageUrls || (ev.thumbnailUrl ? [ev.thumbnailUrl] : []));
                if (ev.lat && ev.lng) setAdjustCoords({ lat: ev.lat, lng: ev.lng });
                else setAdjustCoords(null);
            }
        } else {
            setEditingEventId(null);
            setEventFormData({
                title: '', price: '0', startDate: new Date().toISOString().split('T')[0], startTime: '19:00', endDate: new Date().toISOString().split('T')[0], endTime: '21:00', desc: '',
                isOnline: false, onlineTool: '', onlineUrl: '', locationName: '', locationQuery: '', participantPublic: true,
                visibilityMode: 'public', allowedUsers: [], allowedUserDetails: [],
                chatJoinMode: 'auto'
            });
            setEventSelectedTags(new Set());
            setEventOldImages([]);
            setEventFiles([]);
            setAdjustCoords(null);
        }
        setEventModalOpen(true);
    };

    const openJobModal = (editId?: string) => {
        setIsCreateMenuOpen(false);
        setUserSearchQuery('');
        setUserSearchResults([]);
        if (!userData || (userData.membershipRank !== 'covenant' && userData.membershipRank !== 'guardian' && userData.membershipRank !== 'builder' && userData.userId !== 'admin')) {
            alert('仕事・依頼の掲載は BUILDER 以上の機能です。契約変更をご検討ください。');
            return;
        }
        if (editId) {
            const j = allJobs.find(x => x.id === editId);
            if (j) {
                setEditingJobId(editId);
                setJobFormData({
                    title: j.title, listingType: j.listingType || 'formal_job', type: j.type || '業務委託', category: j.category || 'デザイン', desc: j.desc || '',
                    rewardType: j.rewardType || '固定報酬', rewardAmount: j.rewardAmount || '', period: j.period || '単発',
                    workStyle: j.workStyle || 'フルリモート', locationQuery: '', locationName: j.location || '',
                    skills: j.skills || '', deadline: j.deadline || '', flow: j.flow || '面談1回', company: j.company || '', url: j.url || '',
                    visibilityMode: j.visibilityMode || 'public', allowedUsers: j.allowedUsers || [], allowedUserDetails: j.allowedUserDetails || []
                });
                if (j.lat && j.lng) setAdjustCoords({ lat: j.lat, lng: j.lng });
                else setAdjustCoords(null);
            }
        } else {
            setEditingJobId(null);
            setJobFormData({
                title: '', listingType: 'formal_job', type: '業務委託', category: 'デザイン', desc: '', rewardType: '固定報酬', rewardAmount: '',
                period: '単発', workStyle: 'フルリモート', locationQuery: '', locationName: '', skills: '', deadline: '',
                flow: '面談1回', company: '', url: '', visibilityMode: 'public', allowedUsers: [], allowedUserDetails: []
            });
            setAdjustCoords(null);
        }
        setJobModalOpen(true);
    };

    // ── 削除処理 ──
    const deleteEvent = async (evt: EventData) => {
        if (!user) return;
        try {
            const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', evt.id);
            await deleteDoc(ref);
            setAllEvents(prev => prev.filter(e => e.id !== evt.id));
        } catch (e) {
            console.error('イベント削除エラー:', e);
            alert('削除に失敗しました。');
        }
    };

    const deleteJob = async (j: JobData) => {
        if (!user) return;
        try {
            const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'jobs', j.id);
            await deleteDoc(ref);
            setAllJobs(prev => prev.filter(x => x.id !== j.id));
        } catch (e) {
            console.error('仕事削除エラー:', e);
            alert('削除に失敗しました。');
        }
    };
    const submitEvent = async () => {
        if (!user) return;
        setSubmittingEvent(true);
        try {
            if (!eventFormData.title || !eventFormData.startDate || !eventFormData.startTime || !eventFormData.endDate || !eventFormData.endTime) {
                alert('タイトルと日時は必須です');
                setSubmittingEvent(false);
                return;
            }
            if (!eventFormData.isOnline && !adjustCoords) {
                alert('オフライン開催の場合は場所を設定してください');
                setSubmittingEvent(false);
                return;
            }

            let finalImageUrls = [...eventOldImages];
            for (let i = 0; i < eventFiles.length; i++) {
                const item = eventFiles[i];
                if (item.file.size > 5 * 1024 * 1024) throw new Error(`画像「${item.file.name}」のサイズが大きすぎます (上限5MB)。`);
                const ext = item.file.name.split('.').pop() || 'jpg';
                const safeFileName = Date.now() + '_' + Math.random().toString(36).substring(2, 8) + '.' + ext;
                const snap = await uploadBytes(ref(storage, `events/${user.uid}/${safeFileName}`), item.file);
                finalImageUrls.push(await getDownloadURL(snap.ref));
            }

            let thumbnailUrl = finalImageUrls.length > 0 ? finalImageUrls[0] : null;
            const customTags = eventCustomTags ? eventCustomTags.split(',').map(s=>s.trim()).filter(Boolean) : [];
            const finalTags = [...Array.from(eventSelectedTags), ...customTags];

            let finalOrganizerId = user.uid;
            let finalOrganizerName = userData?.name || userData?.userId || '主催者';
            let finalOrganizerAvatar = userData?.photoURL || null;

            if (userData?.userId === 'admin' && (eventFormData as any).overrideUserId) {
                const targetRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
                const q = query(targetRef, where("userId", "==", ((eventFormData as any).overrideUserId).trim()));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    setSubmittingEvent(false);
                    return alert(`エラー: 指定されたユーザーID「@${(eventFormData as any).overrideUserId}」は見つかりませんでした。`);
                }
                const docSnap = querySnapshot.docs[0];
                finalOrganizerId = docSnap.id;
                const tData = docSnap.data();
                finalOrganizerName = tData.name || tData.userId || '主催者';
                finalOrganizerAvatar = tData.photoURL || null;
            } else if (editingEventId) {
                const oldEvt = allEvents.find(e => e.id === editingEventId);
                if (oldEvt) {
                    finalOrganizerId = oldEvt.organizerId || finalOrganizerId;
                    finalOrganizerName = oldEvt.organizerName || finalOrganizerName;
                }
            }

            const evtData: any = {
                title: eventFormData.title, price: parseInt(eventFormData.price) || 0,
                startDate: eventFormData.startDate, startTime: eventFormData.startTime,
                endDate: eventFormData.endDate, endTime: eventFormData.endTime,
                endTimestamp: new Date(`${eventFormData.endDate}T${eventFormData.endTime}`).toISOString(),
                description: eventFormData.desc, tags: finalTags, thumbnailUrl, imageUrls: finalImageUrls,
                organizerId: finalOrganizerId, organizerName: finalOrganizerName,
                isParticipantsPublic: eventFormData.participantPublic, updatedAt: serverTimestamp(),
                visibilityMode: eventFormData.visibilityMode, allowedUsers: eventFormData.allowedUsers, allowedUserDetails: eventFormData.allowedUserDetails
            };

            if (!editingEventId) {
                evtData.createdAt = serverTimestamp();
                evtData.participantCount = 0;
                evtData.participants = [];
                evtData.chatJoinMode = eventFormData.chatJoinMode;
            }

            if (eventFormData.isOnline) {
                evtData.isOnline = true;
                evtData.locationName = "オンライン (" + (eventFormData.onlineTool || "ツール未定") + ")";
                evtData.onlineUrl = eventFormData.onlineUrl;
                evtData.lat = null; evtData.lng = null;
            } else {
                evtData.isOnline = false;
                evtData.locationName = eventFormData.locationName || "場所名未設定";
                evtData.lat = adjustCoords?.lat || null; evtData.lng = adjustCoords?.lng || null;
            }

            if (editingEventId) {
                await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', editingEventId), evtData);
                alert('イベントを更新しました！');
            } else {
                const newDocRef = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'events'), evtData);
                
                // Disseminate to followers
                try {
                    const followersSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'followers'));
                    const promises = followersSnap.docs.map(fDoc => {
                        return addDoc(collection(db, 'artifacts', APP_ID, 'users', fDoc.id, 'notifications'), {
                            type: 'event', title: '新しいイベント', body: `${userData?.name || 'ユーザー'}さんが新しいイベント「${eventFormData.title}」を企画・公開しました。`,
                            link: `/events?eventId=${newDocRef.id}`, isRead: false, createdAt: Date.now()
                        });
                    });
                    await Promise.allSettled(promises);
                } catch(e) { console.error("Event Notification Gen Failed:", e); }

                // Create associated NoahChat event room (only if not editing, or handle creation)
                try {
                     const expDate = new Date(new Date(`${eventFormData.endDate}T${eventFormData.endTime}`).getTime() + 10 * 24 * 60 * 60 * 1000);
                     await addDoc(collection(db, 'rooms'), {
                         type: 'event',
                         groupId: newDocRef.id,
                         groupName: eventFormData.title,
                         participants: [finalOrganizerId],
                         createdAt: serverTimestamp(),
                         updatedAt: serverTimestamp(),
                         joinMode: eventFormData.chatJoinMode || 'auto',
                         expiresAt: expDate.toISOString(),
                         organizerId: finalOrganizerId,
                     });
                } catch(e) { console.error("Event Room Creation Failed:", e); }

                alert('イベントを企画しました！');
            }
            
            setEventModalOpen(false);
            setEventFiles([]);
            setEventOldImages([]);
            loadData();
        } catch (e: any) {
            console.error(e);
            alert('処理に失敗しました。\nエラー: ' + e.message);
        }
        setSubmittingEvent(false);
    };

    const submitJob = async () => {
        if (!user) return;
        setSubmittingJob(true);
        try {
            if (!jobFormData.title || !jobFormData.desc) {
                alert('必須項目(タイトル・詳細)を入力してください');
                setSubmittingJob(false);
                return;
            }
            if (jobFormData.workStyle !== 'フルリモート' && !adjustCoords) {
                alert('勤務地・活動場所をマップで設定してください');
                setSubmittingJob(false);
                return;
            }

            let finalOrganizerId = user.uid;
            let finalOrganizerName = userData?.name || userData?.userId || '投稿者';
            let finalOrganizerAvatar = userData?.photoURL || null;
            if (editingJobId) {
                const oldJob = allJobs.find(j => j.id === editingJobId);
                if (oldJob) {
                    finalOrganizerId = oldJob.organizerId || finalOrganizerId;
                    finalOrganizerName = oldJob.organizerName || finalOrganizerName;
                    finalOrganizerAvatar = oldJob.organizerAvatar || finalOrganizerAvatar;
                }
            }

            const jbData: any = {
                title: jobFormData.title, listingType: jobFormData.listingType, type: jobFormData.type, category: jobFormData.category, desc: jobFormData.desc,
                rewardType: jobFormData.rewardType, rewardAmount: jobFormData.rewardAmount, period: jobFormData.period,
                workStyle: jobFormData.workStyle, location: jobFormData.locationName, skills: jobFormData.skills,
                deadline: jobFormData.deadline, flow: jobFormData.flow, company: jobFormData.company, url: jobFormData.url,
                organizerId: finalOrganizerId, organizerName: finalOrganizerName, organizerAvatar: finalOrganizerAvatar,
                updatedAt: serverTimestamp(), visibilityMode: jobFormData.visibilityMode, allowedUsers: jobFormData.allowedUsers, allowedUserDetails: jobFormData.allowedUserDetails
            };

            if (!editingJobId) jbData.createdAt = serverTimestamp();
            if (jobFormData.workStyle === 'フルリモート') {
                jbData.lat = null; jbData.lng = null; jbData.location = "フルリモート";
            } else if (adjustCoords) {
                jbData.lat = adjustCoords.lat; jbData.lng = adjustCoords.lng;
            }

            if (editingJobId) {
                await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'jobs', editingJobId), jbData);
                alert('募集情報を更新しました！');
            } else {
                const newDocRef = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'jobs'), jbData);
                
                // Disseminate to followers
                try {
                    const followersSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'followers'));
                    const promises = followersSnap.docs.map(fDoc => {
                        return addDoc(collection(db, 'artifacts', APP_ID, 'users', fDoc.id, 'notifications'), {
                            type: 'job', title: '新しい仕事・依頼', body: `${userData?.name || 'ユーザー'}さんが新しい仕事・依頼「${jobFormData.title}」を募集開始しました。`,
                            link: `/events?jobId=${newDocRef.id}`, isRead: false, createdAt: Date.now()
                        });
                    });
                    await Promise.allSettled(promises);
                } catch(e) { console.error("Job Notification Gen Failed:", e); }
                
                alert('募集を掲載しました！');
            }
            setJobModalOpen(false);
            loadData();
        } catch(e: any) {
            console.error(e);
            alert('処理に失敗しました。\nエラー: ' + e.message);
        }
        setSubmittingJob(false);
    };

    const toggleParticipate = async (evt: EventData) => {
        if (!user) return alert('ログインが必要です');
        
        try {
            const myJoinRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'participating_events', evt.id);
            const partRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', evt.id, 'participants', user.uid);
            
            const isJoined = eventJoinStatusMap[evt.id] || false;
            
            if (isJoined) {
                await deleteDoc(partRef);
                await deleteDoc(myJoinRef);
                
                // Fallback sync for count
                const evtRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', evt.id);
                try {
                    await updateDoc(evtRef, { participants: arrayRemove(user.uid), participantCount: Math.max(0, (evt.participantCount || 1) - 1) });
                } catch(e) {}

                setEventJoinStatusMap(prev => ({...prev, [evt.id]: false}));
                setRefreshPartsKey(k => k + 1);
                alert('参加をキャンセルしました。');
            } else {
                const ts = serverTimestamp();
                await setDoc(partRef, { joinedAt: ts, uid: user.uid });
                await setDoc(myJoinRef, { joinedAt: ts, eventId: evt.id });

                const evtRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', evt.id);
                try {
                    await updateDoc(evtRef, { participants: arrayUnion(user.uid), participantCount: (evt.participantCount || 0) + 1 });

                    // Join NoahChat Event Room
                    const joinMode = evt.chatJoinMode || 'auto';
                    const roomsRef = collection(db, 'rooms');
                    const qRooms = query(roomsRef, where('groupId', '==', evt.id), where('type', '==', 'event'));
                    getDocs(qRooms).then(snap => {
                       if (!snap.empty) {
                          const roomDoc = snap.docs[0];
                          if (joinMode === 'approval') {
                             updateDoc(doc(db, 'rooms', roomDoc.id), { pendingParticipants: arrayUnion(user.uid) });
                          } else {
                             updateDoc(doc(db, 'rooms', roomDoc.id), { participants: arrayUnion(user.uid) });
                          }
                       }
                    }).catch(console.error);

                } catch(e) {}

                setEventJoinStatusMap(prev => ({...prev, [evt.id]: true}));
                setRefreshPartsKey(k => k + 1);
                
                if (evt.organizerId && evt.organizerId !== user.uid) {
                    try {
                        await addDoc(collection(db, 'artifacts', APP_ID, 'users', evt.organizerId, 'notifications'), {
                            type: 'event', title: 'イベントへの新規参加', body: `${userData?.name || 'ユーザー'}さんがあなたのイベント「${evt.title}」に参加申し込みしました！`,
                            link: `/events?eventId=${evt.id}`, isRead: false, createdAt: Date.now()
                        });
                    } catch(e) { console.error(e); }
                }

                alert('イベントの参加申し込みが完了しました！');
            }
        } catch (e: any) {
            console.error(e);
            alert('処理に失敗しました。');
        }
    };

    // ── Design tokens ──
    const BG='#f8f6f3', SB='#1a3024', LIME='#8ecfb2', SAGE='#4a7c59';
    const T1='#2a2520', T2='#7a7068', TM='#b0a89e';
    const NEU='4px 4px 12px #dbd7d2,-4px -4px 12px #ffffff';
    const NEU_IN='inset 3px 3px 8px #e4e0db,inset -3px -3px 8px #ffffff';
    const activeTab:React.CSSProperties={background:SB,color:LIME,borderRadius:10,padding:'8px 16px',fontSize:11,fontWeight:800,letterSpacing:'.06em',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap',transition:'all .2s'};
    const inactiveTab:React.CSSProperties={background:'transparent',color:T2,borderRadius:10,padding:'8px 16px',fontSize:11,fontWeight:700,letterSpacing:'.06em',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap',transition:'all .2s'};

    const logoutFn = async () => {
        const { auth: fireAuth } = await import('@/lib/firebase');
        const { signOut } = await import('firebase/auth');
        try { await signOut(fireAuth); router.push('/login'); } catch {}
    };

    return (
        <AppShell
            activeHref="/events"
            currentUid={user?.uid || ''}
            userName={userData?.name || user?.displayName || user?.email || undefined}
            userIdStr={user?.email || undefined}
            photoURL={userData?.photoURL || user?.photoURL || undefined}
            hideTopbarOnMobile
            onLogout={logoutFn}
        >

            {/* ── Top Tab Bar ── */}
            <div className="ev-top-tab-bar" style={{position:'sticky',top:0,width:'100%',zIndex:40,background:`${BG}f5`,backdropFilter:'blur(16px)',borderBottom:`1px solid rgba(0,0,0,.07)`,padding:'8px 0',boxShadow:'0 2px 12px rgba(0,0,0,.06)'}}>
                <div style={{maxWidth:900,margin:'0 auto',padding:'0 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{display:'flex',background:BG,borderRadius:14,padding:4,boxShadow:NEU_IN,gap:2,flex:1}}>
                        <button onClick={()=>setViewMode('map')} style={viewMode==='map'?activeTab:inactiveTab}>
                            <MapPin size={13}/>マップ
                        </button>
                        <button onClick={()=>setViewMode('list-events')} style={viewMode==='list-events'?activeTab:inactiveTab}>
                            <List size={13}/>イベント
                        </button>
                        <button onClick={()=>setViewMode('list-jobs')} style={viewMode==='list-jobs'?activeTab:inactiveTab}>
                            <Briefcase size={13}/>仕事・依頼
                        </button>
                    </div>
                    <button onClick={()=>setIsFilterOpen(true)} title="絞り込み"
                        style={{marginLeft:10,width:38,height:38,borderRadius:10,border:'none',background:BG,boxShadow:NEU,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:SAGE,flexShrink:0}}>
                        <Sliders size={16}/>
                    </button>
                </div>
            </div>

            {/* ── Filter Panel ── */}
            <div style={{position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,.4)',backdropFilter:'blur(4px)',transition:'opacity .3s',
                opacity:isFilterOpen?1:0,pointerEvents:isFilterOpen?'auto':'none'}}>
                <div style={{position:'absolute',right:0,top:0,height:'100%',width:320,background:BG,boxShadow:'-8px 0 40px rgba(0,0,0,.15)',
                    transform:isFilterOpen?'translateX(0)':'translateX(100%)',transition:'transform .3s',display:'flex',flexDirection:'column'}}>
                    {/* Header */}
                    <div style={{padding:'16px 20px',borderBottom:`1px solid rgba(0,0,0,.07)`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <h3 style={{margin:0,fontSize:15,fontWeight:800,color:T1,display:'flex',alignItems:'center',gap:8}}>
                            <Sliders size={16} color={SAGE}/>
                            {viewMode==='list-jobs'?'仕事・依頼の絞り込み':'イベントの絞り込み'}
                        </h3>
                        <button onClick={()=>setIsFilterOpen(false)}
                            style={{width:32,height:32,borderRadius:8,border:'none',background:BG,boxShadow:NEU,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T2}}>
                            <X size={16}/>
                        </button>
                    </div>
                    {/* Body */}
                    <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:20}}>
                        {viewMode!=='list-jobs' ? (
                            <>
                                {[{label:'開催時期',val:eventDateFilter,set:setEventDateFilter,icon:<Calendar size={13} color={SAGE}/>,opts:[{v:'all',l:'すべて'},{v:'today',l:'今日'},{v:'week',l:'1週間以内'},{v:'month',l:'1ヶ月以内'}]},
                                 {label:'開催形式',val:eventFormatFilter,set:setEventFormatFilter,icon:<MapPin size={13} color={SAGE}/>,opts:[{v:'all',l:'すべて'},{v:'offline',l:'オフラインのみ'},{v:'online',l:'オンラインのみ'}]},
                                 {label:'参加費',val:eventPriceFilter,set:setEventPriceFilter,icon:<DollarSign size={13} color={SAGE}/>,opts:[{v:'all',l:'すべて'},{v:'free',l:'無料のみ'},{v:'paid',l:'有料のみ'}]}].map(({label,val,set,icon,opts})=>(
                                    <div key={label}>
                                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,color:T2,marginBottom:8}}>{icon}{label}</label>
                                        <select value={val} onChange={e=>set(e.target.value)}
                                            style={{width:'100%',boxSizing:'border-box',background:BG,border:'none',borderRadius:10,padding:'10px 14px',fontSize:13,color:T1,boxShadow:NEU_IN,outline:'none',cursor:'pointer'}}>
                                            {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                                        </select>
                                    </div>
                                ))}
                                <div>
                                    <label style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,color:T2,marginBottom:10}}><Tags size={13} color={SAGE}/>タグで絞り込み</label>
                                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                                        {PRESET_TAGS.map(tag=>(
                                            <button key={tag} type="button" onClick={()=>toggleEventTagFilter(tag)}
                                                style={{padding:'6px 12px',borderRadius:20,border:'none',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .2s',
                                                    background:eventTagsFilter.has(tag)?SB:BG,
                                                    color:eventTagsFilter.has(tag)?LIME:T2,
                                                    boxShadow:eventTagsFilter.has(tag)?'0 4px 12px rgba(26,48,36,.3)':NEU}}>
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {[{label:'募集タイプ',val:jobTypeFilter,set:setJobTypeFilter,icon:<Briefcase size={13} color={SAGE}/>,opts:[{v:'',l:'指定なし'},{v:'formal_job',l:'求人・業務委託'},{v:'casual_request',l:'軽いお願い・アルバイト'},{v:'lending',l:'モノ・場所の貸し借り'},{v:'member',l:'仲間・パートナー募集'}]},
                                 {label:'業種カテゴリ',val:jobCategoryFilter,set:setJobCategoryFilter,icon:<Briefcase size={13} color={SAGE}/>,opts:[{v:'',l:'指定なし'},{v:'デザイン',l:'デザイン'},{v:'エンジニア',l:'エンジニア'},{v:'マーケティング',l:'マーケティング'},{v:'営業',l:'営業'},{v:'動画制作',l:'動画制作'},{v:'ライティング',l:'ライティング'},{v:'事務・サポート',l:'事務・サポート'},{v:'その他',l:'その他'}]},
                                 {label:'勤務形態',val:jobWorkstyleFilter,set:setJobWorkstyleFilter,icon:<Building size={13} color={SAGE}/>,opts:[{v:'',l:'指定なし'},{v:'フルリモート',l:'フルリモート'},{v:'一部出社',l:'一部出社'},{v:'出社必須',l:'出社必須'}]},
                                 {label:'報酸形態',val:jobRewardFilter,set:setJobRewardFilter,icon:<DollarSign size={13} color={SAGE}/>,opts:[{v:'',l:'指定なし'},{v:'固定報酸',l:'固定報酸'},{v:'時給',l:'時給'},{v:'月給',l:'月給'},{v:'成果報酸',l:'成果報酸'},{v:'無償・レベニューシェア',l:'無償・レベニューシェア'}]}].map(({label,val,set,icon,opts})=>(
                                    <div key={label}>
                                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,color:T2,marginBottom:8}}>{icon}{label}</label>
                                        <select value={val} onChange={e=>set(e.target.value)}
                                            style={{width:'100%',boxSizing:'border-box',background:BG,border:'none',borderRadius:10,padding:'10px 14px',fontSize:13,color:T1,boxShadow:NEU_IN,outline:'none',cursor:'pointer'}}>
                                            {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                    {/* Footer */}
                    <div className="filter-footer-pb" style={{padding:'12px 20px',paddingBottom:'calc(12px + 60px + env(safe-area-inset-bottom))',borderTop:`1px solid rgba(0,0,0,.07)`,flexShrink:0}}>
                        <button onClick={()=>setIsFilterOpen(false)}
                            style={{width:'100%',background:SB,color:LIME,border:'none',borderRadius:12,padding:'13px 0',fontWeight:800,fontSize:13,letterSpacing:'.05em',cursor:'pointer',boxShadow:'0 4px 16px rgba(26,48,36,.3)'}}>
                            絞り込みを適用
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{width:'100%',flex:1,position:'relative',zIndex:0}}>
                {/* View 1: Map */}
                <div className="ev-map-height" style={{position:'relative',width:'100%',display:viewMode==='map'?'block':'none'}}>
                    {/* Floating Map Search Bar — neumorphic style */}
                    {!adjustMode && (
                        <div style={{position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',zIndex:30,width:'90%',maxWidth:440}}>
                            <div style={{position:'relative',background:'rgba(248,246,243,.95)',borderRadius:12,boxShadow:'0 4px 24px rgba(0,0,0,.15)',backdropFilter:'blur(12px)'}}>
                                <Search size={15} style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'#7a7068',pointerEvents:'none'}}/>
                                <input
                                    type="text"
                                    value={mapSearchText}
                                    onChange={(e) => setMapSearchText(e.target.value)}
                                    placeholder="イベント・仕事・場所を検索..."
                                    style={{width:'100%',boxSizing:'border-box',background:'transparent',border:'none',borderRadius:12,padding:'12px 14px 12px 40px',fontSize:13,color:'#2a2520',outline:'none'}}
                                />
                            </div>
                        </div>
                    )}
                    <div ref={mapRef} className="w-full h-full z-[10]" />

                    {adjustMode && (
                        <div style={{position:'fixed',bottom:'calc(6rem + env(safe-area-inset-bottom))',left:'50%',transform:'translateX(-50%)',zIndex:90,width:'90%',maxWidth:360}}>
                            <div style={{background:BG,padding:20,borderRadius:16,boxShadow:'0 8px 32px rgba(0,0,0,.2)',border:`2px solid ${LIME}`,textAlign:'center'}}>
                                <p style={{fontWeight:800,marginBottom:12,fontSize:13,color:T1,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                                    <MapPin size={16} color='#e05050'/>赤色のピンを動かして調整
                                </p>
                                <button onClick={()=>{
                                    if(adjustMode==='event')setEventModalOpen(true);
                                    if(adjustMode==='job')setJobModalOpen(true);
                                    setAdjustMode(null);
                                }} style={{width:'100%',background:SB,color:LIME,border:'none',borderRadius:10,padding:'12px 0',fontWeight:800,fontSize:13,cursor:'pointer',letterSpacing:'.04em'}}>
                                    位置を決定して戻る
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── View 2: List Events ── */}
                <div style={{maxWidth:768,margin:'0 auto',padding:'0 16px 16px',display:viewMode==='list-events'?'block':'none'}}>
                    {/* Search bar */}
                    <div style={{margin:'16px 0',position:'relative'}}>
                        <Search size={15} style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:TM,pointerEvents:'none'}}/>
                        <input type="text" value={mapSearchText} onChange={e=>setMapSearchText(e.target.value)}
                            placeholder="イベント・場所を検索..."
                            style={{width:'100%',boxSizing:'border-box',background:BG,border:'none',borderRadius:12,padding:'12px 14px 12px 40px',fontSize:13,color:T1,boxShadow:NEU_IN,outline:'none'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,paddingBottom:10,borderBottom:`1px solid rgba(0,0,0,.07)`}}>
                        <h2 style={{fontSize:16,fontWeight:800,color:T1,letterSpacing:'.04em',margin:0}}>イベント一覧</h2>
                        <span style={{fontSize:11,color:TM,fontWeight:600}}>{userLocation?'現在地から近い順':'新着順'}</span>
                    </div>
                    {isLoading ? (
                        <div style={{textAlign:'center',padding:'40px 0'}}>
                            <Compass size={36} style={{color:LIME,margin:'0 auto 12px',animation:'spin 1.2s linear infinite',display:'block'}}/>
                            <p style={{fontSize:12,color:T2,fontWeight:700,letterSpacing:'.06em'}}>読み込み中...</p>
                        </div>
                    ) : filteredEvents.length > 0 ? (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
                            {filteredEvents.map(ev => (
                                <div key={ev.id} onClick={()=>setSelectedEvent(ev)}
                                    style={{background:BG,borderRadius:16,boxShadow:NEU,cursor:'pointer',display:'flex',overflow:'hidden',height:96,transition:'box-shadow .2s'}}>
                                    {/* Thumbnail */}
                                    <div style={{width:90,flexShrink:0,background:SB,position:'relative',overflow:'hidden'}}>
                                        {ev.thumbnailUrl
                                            ? <img src={ev.thumbnailUrl} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                            : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><Anchor size={22} color={`${LIME}66`}/></div>}
                                        <div style={{position:'absolute',top:4,left:4,display:'flex',flexDirection:'column',gap:3}}>
                                            {ev.isOnline && <span style={{background:SB,color:LIME,fontSize:8,padding:'2px 5px',borderRadius:4,fontWeight:800,letterSpacing:'.04em'}}>オンライン</span>}
                                            {Number(ev.price)===0 && <span style={{background:LIME,color:SB,fontSize:8,padding:'2px 5px',borderRadius:4,fontWeight:800}}>無料</span>}
                                        </div>
                                    </div>
                                    {/* Info */}
                                    <div style={{padding:'10px 12px',flex:1,display:'flex',flexDirection:'column',justifyContent:'space-between',minWidth:0}}>
                                        <h3 style={{fontSize:13,fontWeight:800,color:T1,margin:0,lineHeight:1.3,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{ev.title}</h3>
                                        <div>
                                            <div style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:T2,marginBottom:2}}>
                                                <Calendar size={10} color={LIME}/>{ev.startDate}
                                            </div>
                                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                                <div style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:T2,overflow:'hidden',flex:1}}>
                                                    <MapPin size={10} color={LIME} style={{flexShrink:0}}/>
                                                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.isOnline?ev.locationName:(ev.locationName||'未設定')}</span>
                                                </div>
                                                {!ev.isOnline&&ev.lat&&ev.lng&&userLocation&&(
                                                    <span style={{fontSize:9,color:SAGE,fontWeight:700,whiteSpace:'nowrap',marginLeft:4}}>
                                                        {calculateDistance(userLocation.lat,userLocation.lng,ev.lat,ev.lng).toFixed(1)}km
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{textAlign:'center',padding:'48px 0',color:TM}}>
                            <Anchor size={32} style={{margin:'0 auto 12px',opacity:.3,display:'block'}}/>
                            <p style={{fontSize:13,fontWeight:700}}>条件に合うイベントが見つかりません。</p>
                        </div>
                    )}
                </div>

                {/* ── View 3: List Jobs ── */}
                <div style={{maxWidth:768,margin:'0 auto',padding:'0 16px 16px',display:viewMode==='list-jobs'?'block':'none'}}>
                    <div style={{margin:'16px 0',position:'relative'}}>
                        <Search size={15} style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:TM,pointerEvents:'none'}}/>
                        <input type="text" value={mapSearchText} onChange={e=>setMapSearchText(e.target.value)}
                            placeholder="仕事・依頼を検索..."
                            style={{width:'100%',boxSizing:'border-box',background:BG,border:'none',borderRadius:12,padding:'12px 14px 12px 40px',fontSize:13,color:T1,boxShadow:NEU_IN,outline:'none'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,paddingBottom:10,borderBottom:`1px solid rgba(0,0,0,.07)`}}>
                        <h2 style={{fontSize:16,fontWeight:800,color:T1,letterSpacing:'.04em',margin:0}}>仕事・依頼一覧</h2>
                        <span style={{fontSize:11,color:TM,fontWeight:600}}>新着順</span>
                    </div>
                    {isLoading ? (
                        <div style={{textAlign:'center',padding:'40px 0'}}>
                            <Compass size={36} style={{color:LIME,margin:'0 auto 12px',animation:'spin 1.2s linear infinite',display:'block'}}/>
                            <p style={{fontSize:12,color:T2,fontWeight:700}}>読み込み中...</p>
                        </div>
                    ) : filteredJobs.length > 0 ? (
                        <div style={{display:'flex',flexDirection:'column',gap:12}}>
                            {filteredJobs.map(job => (
                                <div key={job.id} onClick={()=>setSelectedJob(job)}
                                    style={{background:BG,borderRadius:16,boxShadow:NEU,padding:'14px 16px',cursor:'pointer',transition:'box-shadow .2s'}}>
                                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                                        <span style={{fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:6,letterSpacing:'.04em',
                                            background: (job.listingType==='casual_request'||job.listingType==='lending') ? 'rgba(78,170,120,.15)' : SB,
                                            color: (job.listingType==='casual_request'||job.listingType==='lending') ? SAGE : LIME}}>
                                            {job.listingType==='casual_request'?'🙋 カジュアル相談・依頼':(job.listingType==='lending'?'🎁 貸し借り・譲渡':(job.listingType==='member'?'🤝 メンバー募集':`💼 ${job.type||'業務委託'}`))}
                                        </span>
                                        {job.category && <span style={{fontSize:10,color:T2,fontWeight:600}}>{job.category}</span>}
                                    </div>
                                    <h3 style={{fontSize:14,fontWeight:800,color:T1,margin:'0 0 8px',lineHeight:1.4}}>{job.title}</h3>
                                    <div style={{display:'flex',flexWrap:'wrap',gap:'4px 12px'}}>
                                        {job.listingType!=='lending'&&job.rewardType&&(
                                            <span style={{fontSize:11,color:SAGE,fontWeight:700}}>💰 {job.rewardType}：{job.rewardAmount||'応相談'}</span>
                                        )}
                                        {(job.listingType==='formal_job'||job.listingType==='member')&&job.workStyle&&(
                                            <span style={{fontSize:10,color:T2}}>🏢 {job.workStyle}</span>
                                        )}
                                        <span style={{fontSize:10,color:T2}}>🗓 {job.period||'単発'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{textAlign:'center',padding:'48px 0',color:TM}}>
                            <Briefcase size={32} style={{margin:'0 auto 12px',opacity:.3,display:'block'}}/>
                            <p style={{fontSize:13,fontWeight:700}}>条件に合う仕事・依頼が見つかりません。</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Create FAB ── */}
            <div style={{position:'fixed',bottom:'calc(5.5rem + env(safe-area-inset-bottom))',right:20,zIndex:50,display:adjustMode?'none':'flex',flexDirection:'column',alignItems:'flex-end'}}>
                {/* Menu */}
                <div style={{marginBottom:12,background:BG,borderRadius:16,boxShadow:NEU,padding:8,display:'flex',flexDirection:'column',gap:4,width:200,
                    transformOrigin:'bottom right',transform:isCreateMenuOpen?'scale(1)':'scale(.75)',opacity:isCreateMenuOpen?1:0,
                    pointerEvents:isCreateMenuOpen?'auto':'none',transition:'all .2s'}}>
                    <button onClick={()=>openEventModal()}
                        style={{textAlign:'left',padding:'10px 14px',background:'transparent',border:'none',borderRadius:10,fontSize:13,fontWeight:800,color:T1,cursor:'pointer',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid rgba(0,0,0,.06)`}}>
                        <Anchor size={16} color={LIME}/> イベントを企画
                    </button>
                    <button onClick={()=>openJobModal()}
                        style={{textAlign:'left',padding:'10px 14px',background:'transparent',border:'none',borderRadius:10,fontSize:13,fontWeight:800,color:T1,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}>
                        <Briefcase size={16} color={SAGE}/>
                        <span style={{flex:1}}>仕事・依頼を掲載</span>
                        <Lock size={11} color={TM}/>
                    </button>
                </div>
                {/* FAB */}
                <button onClick={()=>setIsCreateMenuOpen(!isCreateMenuOpen)}
                    style={{width:54,height:54,background:SB,color:LIME,borderRadius:'50%',border:`2px solid ${LIME}44`,boxShadow:'0 8px 24px rgba(26,48,36,.4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'transform .2s',transform:isCreateMenuOpen?'rotate(45deg)':'rotate(0)'}}>
                    <CirclePlus size={26}/>
                </button>
            </div>

            {/* SP Theater Menu Details Filter */}
            <div className={`fixed inset-0 z-[60] bg-[#2a1a17]/60 backdrop-blur-sm lg:hidden flex items-end justify-center transition-opacity ${theaterMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="absolute inset-0" onClick={() => setTheaterMenuOpen(false)} />
                <div className={`bg-[#fffdf9] bg-texture w-full rounded-t-xl p-6 transform transition-transform relative shadow-2xl ${theaterMenuOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="flex justify-between items-center mb-4 border-b border-brand-200 pb-3">
                        <h3 className="font-bold text-brand-900 font-serif tracking-widest flex items-center"><ImageIcon className="w-5 h-5 text-brand-500 mr-2" />メディアを選択</h3>
                        <button onClick={() => setTheaterMenuOpen(false)} className="text-brand-400 hover:text-brand-700 bg-brand-50 rounded-sm w-8 h-8 flex items-center justify-center transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>

            {/* Bottom Nav Appears on small screens */}
            <nav className="fixed bottom-0 w-full bg-[#fffdf9] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-brand-200 lg:hidden z-[100] pb-[env(safe-area-inset-bottom)]">
                <div className="flex justify-around items-center h-16">
                    <a href="/home" className="flex flex-col items-center justify-center w-full h-full text-brand-400 hover:text-brand-600 transition-colors">
                        <Ship className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold tracking-widest">航海</span>
                    </a>
                    <a href="/events" className="flex flex-col items-center justify-center w-full h-full text-brand-600 border-t-2 border-brand-500 pt-[2px] transition-colors">
                        <Hourglass className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium tracking-widest">イベント</span>
                    </a>
                    <a href="/search" className="flex flex-col items-center justify-center w-full h-full text-brand-400 hover:text-brand-600 transition-colors">
                        <Compass className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium tracking-widest">さがす</span>
                    </a>
                    <button onClick={() => setTheaterMenuOpen(true)} className="flex flex-col items-center justify-center w-full h-full text-brand-400 hover:text-brand-600 transition-colors">
                        <ImageIcon className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium tracking-widest">メディア</span>
                    </button>
                    <a href="/user" className="flex flex-col items-center justify-center w-full h-full text-brand-400 hover:text-brand-600 transition-colors">
                        <User className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium tracking-widest">マイページ</span>
                    </a>
                </div>
            </nav>
            {/* Full Screen Image Viewer */}
            {fullImageUrl && (
                <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center backdrop-blur-sm transition-opacity" onClick={() => setFullImageUrl(null)}>
                    <img src={fullImageUrl} className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl" />
                    <button className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors"><X className="w-6 h-6" /></button>
                </div>
            )}

            {/* Event Detail Sheet component */}
            <EventDetailSheet
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
                adjustMode={adjustMode === 'event'}
                setFullImageUrl={setFullImageUrl}
                userData={userData}
                refreshPartsKey={refreshPartsKey}
                currentUserId={user?.uid}
                isJoined={selectedEvent ? eventJoinStatusMap[selectedEvent.id] : false}
                toggleParticipate={toggleParticipate}
                openEditModal={openEventModal}
                onDelete={(evt) => {
                    if (window.confirm(`「${evt.title}」を削除しますか？この操作は元に戻せません。`)) {
                        deleteEvent(evt);
                    }
                }}
                onShare={(evt: any) => shareItem(evt, 'event')}
                hideEventLink={true}
            />

            {/* ── Job Detail Sheet ── */}
            <div style={{
                position:'fixed',bottom:0,left:'50%',transform:selectedJob&&!adjustMode?'translateX(-50%) translateY(0)':'translateX(-50%) translateY(110%)',
                width:'100%',maxWidth:600,zIndex:80,background:BG,
                borderRadius:'20px 20px 0 0',boxShadow:'0 -8px 40px rgba(0,0,0,.15)',
                paddingBottom:'calc(80px + env(safe-area-inset-bottom))',
                maxHeight:'90dvh',overflowY:'auto',
                transition:'transform .3s'
            }}>
                {/* Sticky header */}
                <div style={{position:'sticky',top:0,background:`${BG}f8`,backdropFilter:'blur(12px)',zIndex:20,
                    borderBottom:`1px solid rgba(0,0,0,.06)`,display:'flex',alignItems:'center',justifyContent:'space-between',
                    padding:'14px 20px',borderRadius:'20px 20px 0 0'}}>
                    <span style={{fontSize:11,fontWeight:800,color:T2,letterSpacing:'.06em',display:'flex',alignItems:'center',gap:6}}>
                        <Briefcase size={13} color={SAGE}/>仕事・依頼 詳細
                    </span>
                    <button onClick={()=>setSelectedJob(null)}
                        style={{width:30,height:30,borderRadius:'50%',border:'none',background:BG,boxShadow:NEU,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T2}}>
                        <X size={15}/>
                    </button>
                </div>
                <div style={{padding:'16px 20px 24px'}}>
                    {selectedJob && (
                        <div>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                                <span style={{fontSize:10,fontWeight:800,padding:'4px 10px',borderRadius:6,background:SB,color:LIME}}>{selectedJob.type}</span>
                                <span style={{fontSize:11,color:T2,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><Briefcase size={12} color={TM}/>{selectedJob.category}</span>
                            </div>
                            <h2 style={{fontSize:20,fontWeight:800,color:T1,margin:'0 0 16px',lineHeight:1.3}}>{selectedJob.title}</h2>
                            {/* Info grid */}
                            <div style={{background:BG,boxShadow:NEU_IN,borderRadius:14,padding:'4px 0',marginBottom:20}}>
                                {[{icon:<Building size={14} color={TM}/>,label:'勤務形態',val:`${selectedJob.workStyle}  ${selectedJob.location||''}`,green:false},
                                  {icon:<DollarSign size={14} color={SAGE}/>,label:'報酸',val:`${selectedJob.rewardType}：${selectedJob.rewardAmount||'応相談'}`,green:true},
                                  {icon:<Calendar size={14} color={TM}/>,label:'期間・納期',val:selectedJob.period,green:false},
                                  {icon:<User size={14} color={TM}/>,label:'投稿者',val:selectedJob.organizerName,green:false,link:`/user?uid=${selectedJob.organizerId}`}
                                ].map(({icon,label,val,green,link})=>(
                                    <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',borderBottom:`1px solid rgba(0,0,0,.05)`}}>
                                        <span style={{fontSize:12,fontWeight:700,color:T2,display:'flex',alignItems:'center',gap:6}}>{icon}{label}</span>
                                        {link
                                            ? <Link href={link} style={{fontSize:13,fontWeight:700,color:SAGE,textDecoration:'none'}}>{val}</Link>
                                            : <span style={{fontSize:13,fontWeight:700,color:green?SAGE:T1}}>{val}</span>}
                                    </div>
                                ))}
                            </div>
                            <div style={{marginBottom:20}}>
                                <h3 style={{fontSize:13,fontWeight:800,color:T1,margin:'0 0 8px',paddingLeft:10,borderLeft:`3px solid ${LIME}`}}>業務詳細</h3>
                                <div className="markdown-body" style={{fontSize:14,color:T2,lineHeight:1.7}} dangerouslySetInnerHTML={{__html:formatText(selectedJob.desc)}}/>
                            </div>
                            {(selectedJob.skills||selectedJob.flow||selectedJob.url)&&(
                                <div style={{borderTop:`1px solid rgba(0,0,0,.07)`,paddingTop:16,display:'flex',flexDirection:'column',gap:12}}>
                                    {selectedJob.skills&&<div><h4 style={{fontSize:11,fontWeight:700,color:T2,margin:'0 0 4px'}}>必須・歓迎スキル</h4><p style={{fontSize:13,color:T1,margin:0}}>{selectedJob.skills}</p></div>}
                                    {selectedJob.flow&&<div><h4 style={{fontSize:11,fontWeight:700,color:T2,margin:'0 0 4px'}}>選考フロー</h4><p style={{fontSize:13,color:T1,margin:0}}>{selectedJob.flow}</p></div>}
                                    {selectedJob.url&&<div><h4 style={{fontSize:11,fontWeight:700,color:T2,margin:'0 0 4px'}}>関連URL</h4><a href={selectedJob.url} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:SAGE,wordBreak:'break-all'}}>{selectedJob.url}</a></div>}
                                </div>
                            )}
                            <div style={{marginTop:20,display:'flex',flexDirection:'column',gap:10}}>
                                {selectedJob.organizerId!==user?.uid&&(
                                    <button disabled style={{width:'100%',padding:'13px 0',background:`${SB}44`,color:LIME,border:'none',borderRadius:12,fontSize:13,fontWeight:800,cursor:'not-allowed',opacity:.5}}>
                                        応募・連絡する (準備中)
                                    </button>
                                )}
                                {(userData?.userId==='admin'||userData?.uid===selectedJob.organizerId)&&(
                                    <div style={{display:'flex',gap:8}}>
                                        <button onClick={()=>{setSelectedJob(null);openJobModal(selectedJob.id);}}
                                            style={{flex:1,padding:'11px 0',background:BG,boxShadow:NEU,border:'none',borderRadius:12,fontSize:12,fontWeight:700,color:T2,cursor:'pointer'}}>
                                            募集内容を編集する
                                        </button>
                                        <button onClick={()=>{
                                            if (window.confirm(`「${selectedJob.title}」を削除しますか？この操作は元に戻せません。`)) {
                                                deleteJob(selectedJob);
                                                setSelectedJob(null);
                                            }
                                        }} style={{flex:1,padding:'11px 0',background:BG,boxShadow:NEU,border:'1px solid rgba(217,112,112,.3)',borderRadius:12,fontSize:12,fontWeight:700,color:'#d97070',cursor:'pointer'}}>
                                            削除する
                                        </button>
                                    </div>
                                )}
                                <button onClick={()=>shareItem(selectedJob,'job')}
                                    style={{width:'100%',padding:'11px 0',background:BG,boxShadow:NEU,border:'none',borderRadius:12,fontSize:12,fontWeight:700,color:SAGE,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                                    <Share2 size={14}/>募集を共有する (リンクコピー)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Event Modal ── */}
            {eventModalOpen && (
                <div style={{position:'fixed',inset:0,zIndex:2100,background:'rgba(0,0,0,.5)',backdropFilter:'blur(6px)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                    <div style={{background:BG,width:'100%',maxWidth:600,height:'90dvh',borderRadius:'20px 20px 0 0',boxShadow:'0 -12px 48px rgba(0,0,0,.2)',display:'flex',flexDirection:'column'}}>
                        {/* Header */}
                        <div style={{padding:'16px 20px',borderBottom:`1px solid rgba(0,0,0,.07)`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0,borderRadius:'20px 20px 0 0',background:BG}}>
                            <h3 style={{margin:0,fontSize:16,fontWeight:800,color:T1,display:'flex',alignItems:'center',gap:8}}>
                                <Anchor size={16} color={LIME}/>{editingEventId?'イベントを編集':'イベントを企画'}
                            </h3>
                            <button onClick={()=>setEventModalOpen(false)}
                                style={{width:30,height:30,borderRadius:'50%',border:'none',background:BG,boxShadow:NEU,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T2}}>
                                <X size={15}/>
                            </button>
                        </div>
                        <div style={{padding:'0 20px 8px',overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:18}}>
                            <div style={{paddingTop:16}}>
                                <label style={{display:'block',fontSize:11,fontWeight:700,color:T2,marginBottom:8}}>画像 (最大攀5枚)</label>
                                <input type="file" multiple accept="image/*" onChange={e=>{
                                    if(e.target.files){
                                        const newFiles=Array.from(e.target.files).slice(0,5-eventFiles.length-eventOldImages.length);
                                        setEventFiles(prev=>[...prev,...newFiles.map(f=>({file:f,preview:URL.createObjectURL(f)}))]);
                                    }
                                }} style={{width:'100%',fontSize:12,marginBottom:8}}/>
                                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                                    {eventOldImages.map((url,i)=>(
                                        <div key={`old-${i}`} style={{position:'relative',width:60,height:60,borderRadius:8,overflow:'hidden',boxShadow:NEU}}>
                                            <img src={url} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                            <button onClick={()=>setEventOldImages(prev=>prev.filter((_,idx)=>idx!==i))} type="button" style={{position:'absolute',top:0,right:0,background:'rgba(220,50,50,.9)',color:'white',border:'none',borderRadius:'0 0 0 6px',padding:'2px 4px',cursor:'pointer'}}><X size={10}/></button>
                                        </div>
                                    ))}
                                    {eventFiles.map((item,i)=>(
                                        <div key={`new-${i}`} style={{position:'relative',width:60,height:60,borderRadius:8,overflow:'hidden',boxShadow:NEU}}>
                                            <img src={item.preview} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                            <button onClick={()=>setEventFiles(prev=>prev.filter((_,idx)=>idx!==i))} type="button" style={{position:'absolute',top:0,right:0,background:'rgba(220,50,50,.9)',color:'white',border:'none',borderRadius:'0 0 0 6px',padding:'2px 4px',cursor:'pointer'}}><X size={10}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* イベント名 */}
                            <div>
                                <label style={{display:'block',fontSize:11,fontWeight:700,color:T2,marginBottom:8}}>イベント名 <span style={{color:'#e05050'}}>*</span></label>
                                <input type="text" value={eventFormData.title} onChange={e=>setEventFormData({...eventFormData,title:e.target.value})}
                                    placeholder="例: 週末朝活コーヒー会"
                                    style={{width:'100%',boxSizing:'border-box',background:BG,border:'none',borderRadius:10,padding:'11px 14px',fontSize:13,color:T1,boxShadow:NEU_IN,outline:'none'}}/>
                            </div>
                            {/* 参加費 */}
                            <div>
                                <label style={{display:'block',fontSize:11,fontWeight:700,color:T2,marginBottom:8}}>参加費 (円)</label>
                                <input type="number" value={eventFormData.price} onChange={e=>setEventFormData({...eventFormData,price:e.target.value})}
                                    placeholder="0で無料" min="0" step="100"
                                    style={{width:'100%',boxSizing:'border-box',background:BG,border:'none',borderRadius:10,padding:'11px 14px',fontSize:13,color:T1,boxShadow:NEU_IN,outline:'none'}}/>
                            </div>
                            {/* タグ */}
                            <div>
                                <label style={{display:'block',fontSize:11,fontWeight:700,color:T2,marginBottom:10}}>関連タグ</label>
                                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:10}}>
                                    {PRESET_TAGS.map(tag=>(
                                        <button key={tag} type="button" onClick={()=>{
                                            const n=new Set(eventSelectedTags);
                                            if(n.has(tag))n.delete(tag);else n.add(tag);
                                            setEventSelectedTags(n);
                                        }} style={{padding:'6px 12px',borderRadius:20,border:'none',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .2s',
                                            background:eventSelectedTags.has(tag)?SB:BG,
                                            color:eventSelectedTags.has(tag)?LIME:T2,
                                            boxShadow:eventSelectedTags.has(tag)?'0 4px 12px rgba(26,48,36,.3)':NEU}}>
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                <input type="text" value={eventCustomTags} onChange={e=>setEventCustomTags(e.target.value)}
                                    placeholder="独自のカスタムタグ (カンマ区切り)"
                                    style={{width:'100%',boxSizing:'border-box',background:BG,border:'none',borderRadius:10,padding:'10px 14px',fontSize:12,color:T1,boxShadow:NEU_IN,outline:'none'}}/>
                            </div>
                            {/* 日時 */}
                            <div style={{background:BG,boxShadow:NEU_IN,borderRadius:12,padding:'14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                                <div>
                                    <span style={{display:'block',fontSize:11,fontWeight:700,color:T2,marginBottom:6}}>開始 <span style={{color:'#e05050'}}>*</span></span>
                                    <input type="date" value={eventFormData.startDate} onChange={e=>setEventFormData({...eventFormData,startDate:e.target.value})}
                                        style={{width:'100%',boxSizing:'border-box',background:BG,border:`1px solid rgba(0,0,0,.1)`,borderRadius:8,padding:'8px 10px',fontSize:13,color:T1,outline:'none',marginBottom:6}}/>
                                    <input type="time" value={eventFormData.startTime} onChange={e=>setEventFormData({...eventFormData,startTime:e.target.value})}
                                        style={{width:'100%',boxSizing:'border-box',background:BG,border:`1px solid rgba(0,0,0,.1)`,borderRadius:8,padding:'8px 10px',fontSize:13,color:T1,outline:'none'}}/>
                                </div>
                                <div>
                                    <span style={{display:'block',fontSize:11,fontWeight:700,color:T2,marginBottom:6}}>終了 <span style={{color:'#e05050'}}>*</span></span>
                                    <input type="date" value={eventFormData.endDate} onChange={e=>setEventFormData({...eventFormData,endDate:e.target.value})}
                                        style={{width:'100%',boxSizing:'border-box',background:BG,border:`1px solid rgba(0,0,0,.1)`,borderRadius:8,padding:'8px 10px',fontSize:13,color:T1,outline:'none',marginBottom:6}}/>
                                    <input type="time" value={eventFormData.endTime} onChange={e=>setEventFormData({...eventFormData,endTime:e.target.value})}
                                        style={{width:'100%',boxSizing:'border-box',background:BG,border:`1px solid rgba(0,0,0,.1)`,borderRadius:8,padding:'8px 10px',fontSize:13,color:T1,outline:'none'}}/>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-brand-800 cursor-pointer">
                                    <input type="checkbox" checked={eventFormData.isOnline} onChange={e=>setEventFormData({...eventFormData, isOnline: e.target.checked})} className="w-4 h-4 text-brand-600 rounded-sm border-brand-300 focus:ring-brand-500" />
                                    オンライン開催
                                </label>
                            </div>
                            {eventFormData.isOnline ? (
                                <div className="space-y-3 bg-brand-50 p-4 rounded-sm border border-brand-200">
                                    <input type="text" value={eventFormData.onlineTool} onChange={e=>setEventFormData({...eventFormData, onlineTool: e.target.value})} placeholder="開催ツール (例: Zoom)" className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-white" />
                                    <input type="url" value={eventFormData.onlineUrl} onChange={e=>setEventFormData({...eventFormData, onlineUrl: e.target.value})} placeholder="参加URL" className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-white" />
                                </div>
                            ) : (
                                <div className="bg-brand-50 p-4 rounded-sm border border-brand-200">
                                    <div className="flex gap-2 mb-3">
                                        <div className="relative flex-1">
                                            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-400" />
                                            <input type="text" value={eventFormData.locationQuery || ''} onChange={e=>setEventFormData({...eventFormData, locationQuery: e.target.value})} placeholder="住所や建物名で検索" className="w-full border border-brand-200 rounded-sm text-sm pl-9 p-2.5 bg-white" />
                                        </div>
                                        <button onClick={() => searchLocation('event')} type="button" className="bg-[#3e2723] text-[#d4af37] px-4 rounded-sm text-sm font-bold whitespace-nowrap hover:bg-[#2a1a17] tracking-widest border border-[#b8860b]">検索</button>
                                    </div>
                                    <button onClick={() => { setEventModalOpen(false); setAdjustMode('event'); setViewMode('map'); }} type="button" className="w-full py-2 bg-white border border-brand-300 text-brand-700 rounded-sm text-xs font-bold hover:bg-brand-100 transition-colors flex items-center justify-center gap-1 tracking-widest shadow-sm mb-3">
                                        <MapPin className="w-4 h-4 text-brand-500"/> (微調整) 現在のピンを地図で動かす
                                    </button>
                                    {adjustCoords && <p className="text-[10px] text-brand-500 mb-3 text-center">緯度: {adjustCoords.lat.toFixed(4)}, 経度: {adjustCoords.lng.toFixed(4)}</p>}
                                    <input type="text" value={eventFormData.locationName} onChange={e=>setEventFormData({...eventFormData, locationName: e.target.value})} placeholder="表示する場所名 (例: ミッドランドスクエア)" className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-white" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-1 tracking-widest">詳細内容</label>
                                <textarea value={eventFormData.desc} onChange={e=>setEventFormData({...eventFormData, desc: e.target.value})} rows={5} className="w-full border border-brand-200 rounded-sm text-sm p-3 bg-white leading-relaxed" placeholder="イベント詳細"></textarea>
                            </div>
                            
                            <div className="bg-brand-50 p-4 rounded-sm border border-brand-200 mt-4 shadow-sm">
                                <label className="block text-xs font-bold text-brand-700 mb-2 tracking-widest">公開範囲 (Base Visibility)</label>
                                <select value={eventFormData.visibilityMode} onChange={e=>setEventFormData({...eventFormData, visibilityMode: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-3 bg-white mb-4">
                                    <option value="public">全体に公開 (Public)</option>
                                    <option value="mutual">相互フォローに公開 (Mutual followers)</option>
                                    <option value="followers">フォロワーに公開 (Followers)</option>
                                    <option value="following">フォロー中に公開 (Following)</option>
                                    <option value="private">選択した乗組員のみ (Private / Selected only)</option>
                                </select>

                                <label className="block text-xs font-bold text-brand-700 mb-2 tracking-widest border-t border-brand-200 pt-3">＋ 特定の乗組員を追加して公開</label>
                                <div className="flex gap-2 mb-3">
                                    <input type="text" value={userSearchQuery} onChange={e=>setUserSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchUsers(userSearchQuery); }}} placeholder="ユーザー名やIDで検索" className="flex-1 border border-brand-200 rounded-sm text-sm p-2 bg-white" />
                                    <button type="button" onClick={() => searchUsers(userSearchQuery)} disabled={isSearchingUsers} className="bg-brand-600 text-white px-3 rounded-sm text-sm font-bold tracking-widest hover:bg-brand-700">{isSearchingUsers ? '検索中...' : '検索'}</button>
                                </div>
                                {userSearchResults.length > 0 && (
                                    <div className="border border-brand-200 rounded-sm bg-white overflow-hidden mb-3 max-h-48 overflow-y-auto">
                                        {userSearchResults.map(u => (
                                            <div key={u.uid} className="flex items-center justify-between p-2 border-b border-brand-100 hover:bg-brand-50">
                                                <div className="flex items-center gap-2">
                                                    <img src={u.photoURL || 'https://via.placeholder.com/32?text=User'} alt="user" className="w-6 h-6 rounded-full object-cover" />
                                                    <span className="text-xs font-bold text-brand-800">{u.name || u.userId}</span>
                                                </div>
                                                <button type="button" onClick={() => {
                                                    if (!eventFormData.allowedUsers.includes(u.uid)) {
                                                        setEventFormData({...eventFormData, allowedUsers: [...eventFormData.allowedUsers, u.uid], allowedUserDetails: [...eventFormData.allowedUserDetails, {uid: u.uid, name: u.name || u.userId}]});
                                                    }
                                                    setUserSearchResults(prev => prev.filter(x => x.uid !== u.uid));
                                                }} className="text-[10px] bg-brand-100 text-brand-700 px-2 py-1 rounded-sm tracking-widest font-bold">追加</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {eventFormData.allowedUserDetails.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {eventFormData.allowedUserDetails.map(u => (
                                            <div key={u.uid} className="flex items-center gap-1 bg-white border border-brand-200 px-2 py-1 rounded-full text-xs shadow-sm">
                                                <span className="font-bold text-brand-700">{u.name}</span>
                                                <button type="button" onClick={() => {
                                                    setEventFormData({
                                                        ...eventFormData,
                                                        allowedUsers: eventFormData.allowedUsers.filter(id => id !== u.uid),
                                                        allowedUserDetails: eventFormData.allowedUserDetails.filter(ud => ud.uid !== u.uid)
                                                    });
                                                }} className="text-red-500 hover:text-red-700"><X className="w-3 h-3"/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <label className="block text-xs font-bold text-brand-700 mb-2 mt-4 tracking-widest border-t border-brand-200 pt-3">NoahChat 自動作成グループの参加設定</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-brand-800">
                                        <input type="radio" checked={eventFormData.chatJoinMode === 'auto'} onChange={() => setEventFormData({...eventFormData, chatJoinMode: 'auto'})} className="text-brand-600 focus:ring-brand-500" />
                                        自動参加（誰でも）
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-brand-800">
                                        <input type="radio" checked={eventFormData.chatJoinMode === 'approval'} onChange={() => setEventFormData({...eventFormData, chatJoinMode: 'approval'})} className="text-brand-600 focus:ring-brand-500" />
                                        承認制（主催者が承認）
                                    </label>
                                </div>
                            </div>
                            
                            {userData?.userId === 'admin' && (
                                <div className="bg-red-50 p-4 rounded-sm border border-red-200 mt-4 shadow-inner">
                                    <h4 className="text-xs font-bold text-red-600 mb-2 tracking-widest">【管理者専用】代理投稿</h4>
                                    <input type="text" value={(eventFormData as any).overrideUserId || ''} onChange={e=>setEventFormData({...eventFormData, overrideUserId: e.target.value} as any)} className="w-full border-red-200 rounded-sm text-sm p-2 bg-white" placeholder="代理投稿する場合のユーザーID (uid)" />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer-pb" style={{padding:'12px 16px',borderTop:`1px solid rgba(0,0,0,.08)`,background:BG,paddingBottom:'calc(12px + 60px + env(safe-area-inset-bottom))',flexShrink:0}}>
                            <button onClick={submitEvent} disabled={submittingEvent}
                                style={{width:'100%',background:submittingEvent?SAGE:SB,color:LIME,border:'none',borderRadius:12,padding:'13px 0',fontWeight:800,fontSize:13,letterSpacing:'.05em',cursor:'pointer',opacity:submittingEvent?.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                                {submittingEvent && <Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/>}
                                {submittingEvent?'保存中...':(editingEventId?'更新する':'企画する')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Job Modal */}
            {jobModalOpen && (
                <div style={{position:'fixed',inset:0,zIndex:2100,background:'rgba(42,26,23,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                    <div className="bg-[#fffdf9] bg-texture w-full sm:w-[650px] h-[90dvh] sm:h-[90vh] rounded-t-sm sm:rounded-sm shadow-2xl flex flex-col border border-brand-300">
                        <div className="p-4 border-b border-brand-200 flex justify-between items-center flex-shrink-0 bg-[#fffdf9]">
                            <h3 className="font-bold text-lg text-brand-900 font-serif tracking-widest">{editingJobId ? '仕事・依頼を編集' : '仕事・依頼を掲載'}</h3>
                            <button onClick={() => setJobModalOpen(false)} className="p-2 text-brand-400 hover:text-brand-700"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-1 tracking-widest">募集タイプ</label>
                                <select value={jobFormData.listingType} onChange={e=>setJobFormData({...jobFormData, listingType: e.target.value, category: e.target.value === 'casual_request' ? '各種相談・教えて' : (e.target.value === 'lending' ? 'あげる・譲る' : 'デザイン')})} className="w-full border border-brand-300 rounded-sm text-sm p-3 bg-brand-50 mb-2 font-bold text-brand-900 border-l-4 border-l-[#b8860b] shadow-sm tracking-widest">
                                    <option value="formal_job">💼 本格的な求人・業務委託</option>
                                    <option value="casual_request">🙋 軽いお願い・日常の相談（インスタ教えて等）</option>
                                    <option value="lending">🎁 不用品の譲渡・モノの貸し借り</option>
                                    <option value="member">🤝 仲間・共同創業者募集</option>
                                </select>
                                <p className="text-[10px] text-brand-500 mb-1 font-bold">※選択したタイプに合わせて続く入力項目が最適化されます。</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-1 tracking-widest">募集タイトル</label>
                                <input type="text" value={jobFormData.title} onChange={e=>setJobFormData({...jobFormData, title: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder={jobFormData.listingType === 'casual_request' ? "例: デスクの組み立てを手伝って！" : (jobFormData.listingType === 'lending' ? "例: 撮影・配信用カメラお貸しします" : "例: 新規事業のUI/UXデザイナー募集")} required />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-1 tracking-widest">{jobFormData.listingType === 'lending' ? '貸し借りするモノ・場所の詳細' : '業務やお願いの詳細'}</label>
                                <textarea value={jobFormData.desc} onChange={e=>setJobFormData({...jobFormData, desc: e.target.value})} rows={6} className="w-full border border-brand-200 rounded-sm text-sm p-3 bg-white leading-relaxed" required></textarea>
                            </div>

                            {jobFormData.listingType === 'formal_job' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-brand-700 mb-1">募集形式</label>
                                        <select value={jobFormData.type} onChange={e=>setJobFormData({...jobFormData, type: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white">
                                            <option value="業務委託">業務委託</option>
                                            <option value="正社員">正社員</option>
                                            <option value="契約社員">契約社員</option>
                                            <option value="アルバイト">アルバイト</option>
                                            <option value="単発依頼">単発依頼</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-700 mb-1">職種カテゴリ</label>
                                        <select value={jobFormData.category} onChange={e=>setJobFormData({...jobFormData, category: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white">
                                            <option value="デザイン">デザイン</option>
                                            <option value="エンジニア">エンジニア</option>
                                            <option value="マーケティング">マーケティング</option>
                                            <option value="営業">営業</option>
                                            <option value="動画制作">動画制作・写真撮影</option>
                                            <option value="ライティング">ライティング</option>
                                            <option value="事務・サポート">事務・サポート</option>
                                            <option value="その他">その他</option>
                                        </select>
                                    </div>
                                </div>
                            ) : jobFormData.listingType === 'casual_request' ? (
                                <div>
                                    <label className="block text-xs font-bold text-brand-700 mb-1">カテゴリ</label>
                                    <select value={jobFormData.category} onChange={e=>setJobFormData({...jobFormData, category: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white">
                                        <option value="各種相談・教えて">各種相談・教えて (インスタ運用など)</option>
                                        <option value="作業手伝い・ボランティア">作業手伝い・ボランティア</option>
                                        <option value="おつかい・代行">おつかい・代行</option>
                                        <option value="趣味・スキル交換">趣味・スキル交換</option>
                                        <option value="その他">その他</option>
                                    </select>
                                </div>
                            ) : jobFormData.listingType === 'lending' ? (
                                <div>
                                    <label className="block text-xs font-bold text-brand-700 mb-1">取引形態</label>
                                    <select value={jobFormData.category} onChange={e=>setJobFormData({...jobFormData, category: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white">
                                        <option value="あげる・譲る">不要品を無償で譲る・あげる</option>
                                        <option value="譲ってほしい・貸して">譲ってほしい・探している</option>
                                        <option value="有料で譲る・売る">有料で売る・提供する</option>
                                    </select>
                                </div>
                            ) : null}

                            {(jobFormData.listingType === 'formal_job' || jobFormData.listingType === 'member' || jobFormData.listingType === 'casual_request') && (
                                <div>
                                    <label className="block text-xs font-bold text-brand-700 mb-1 tracking-widest">{jobFormData.listingType === 'formal_job' ? '必須・歓迎スキル' : 'こんな人に来てほしい・求める条件'}</label>
                                    <input type="text" value={jobFormData.skills} onChange={e=>setJobFormData({...jobFormData, skills: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder={jobFormData.listingType === 'formal_job' ? "例: Figma, React等の経験" : "例: インスタに強くて親切な人"} />
                                </div>
                            )}

                            {(jobFormData.listingType === 'formal_job' || jobFormData.listingType === 'casual_request') && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-brand-700 mb-1">{jobFormData.listingType === 'casual_request' ? 'お礼の形態' : '報酬形態'}</label>
                                        <select value={jobFormData.rewardType} onChange={e=>setJobFormData({...jobFormData, rewardType: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white">
                                            <option value="固定報酬">固定報酬</option>
                                            <option value="時給">時給</option>
                                            <option value="成果報酬">成果報酬</option>
                                            <option value="応相談">応相談</option>
                                            {jobFormData.listingType === 'casual_request' && <option value="ご飯やお酒奢ります">ご飯やお酒奢ります</option>}
                                            {jobFormData.listingType === 'casual_request' && <option value="無償のお願い(善意)">無償のお願い(善意)</option>}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-700 mb-1">{jobFormData.listingType === 'casual_request' ? '金額目安(あれば)' : '金額・レンジ'}</label>
                                        <input type="text" value={jobFormData.rewardAmount} onChange={e=>setJobFormData({...jobFormData, rewardAmount: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder={jobFormData.listingType === 'casual_request' ? "例: 2000円" : "例: 10万円〜"} />
                                    </div>
                                </div>
                            )}

                            {(jobFormData.listingType === 'formal_job' || jobFormData.listingType === 'member') && (
                                <div>
                                    <label className="block text-xs font-bold text-brand-700 mb-1">勤務形態</label>
                                    <select value={jobFormData.workStyle} onChange={e=>setJobFormData({...jobFormData, workStyle: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white">
                                        <option value="フルリモート">フルリモート</option>
                                        <option value="一部出社">一部出社</option>
                                        <option value="出社必須">出社必須</option>
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-1">期間・時期</label>
                                <input type="text" value={jobFormData.period} onChange={e=>setJobFormData({...jobFormData, period: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder={jobFormData.listingType === 'lending' ? '例: 3/20の1日間のみ' : '例: 単発 / 週3日〜'} />
                            </div>

                            {jobFormData.listingType !== 'lending' && (
                                <div>
                                    <label className="block text-xs font-bold text-brand-700 mb-1">募集期限</label>
                                    <input type="date" value={jobFormData.deadline} onChange={e=>setJobFormData({...jobFormData, deadline: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" />
                                </div>
                            )}

                            {jobFormData.listingType === 'formal_job' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-700 mb-1">選考フロー</label>
                                        <input type="text" value={jobFormData.flow} onChange={e=>setJobFormData({...jobFormData, flow: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder="例: 書類選考 → 面談1回" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-700 mb-1">会社・組織名</label>
                                        <input type="text" value={jobFormData.company} onChange={e=>setJobFormData({...jobFormData, company: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder="例: 株式会社NOAH" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-700 mb-1">関連URL</label>
                                        <input type="url" value={jobFormData.url} onChange={e=>setJobFormData({...jobFormData, url: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder="https://" />
                                    </div>
                                </>
                            )}

                            {((jobFormData.listingType !== 'formal_job' && jobFormData.listingType !== 'member') || jobFormData.workStyle !== 'フルリモート') && (
                                <div className="p-3 border border-brand-200 rounded-sm bg-brand-50 mt-2">
                                    <button onClick={() => { setJobModalOpen(false); setAdjustMode('job'); setViewMode('map'); }} type="button" className="w-full py-2 bg-white border border-brand-300 text-brand-700 rounded-sm text-xs font-bold hover:bg-brand-100 transition-colors flex items-center justify-center gap-1 mb-2 shadow-sm tracking-widest">
                                        <MapPin className="w-4 h-4 text-brand-500" /> 地図で{jobFormData.listingType === 'formal_job' ? '勤務地' : '場所'}を微調整する
                                    </button>
                                    {adjustCoords && <p className="text-[10px] text-brand-500 mb-3 text-center">緯度: {adjustCoords.lat.toFixed(4)}, 経度: {adjustCoords.lng.toFixed(4)}</p>}
                                    <input type="text" value={jobFormData.locationName} onChange={e=>setJobFormData({...jobFormData, locationName: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder="表示名 (例: 渋谷)" />
                                </div>
                            )}

                            <div className="bg-brand-50 p-4 rounded-sm border border-brand-200 mt-4 shadow-sm">
                                <label className="block text-xs font-bold text-brand-700 mb-2 tracking-widest">公開範囲 (Base Visibility)</label>
                                <select value={jobFormData.visibilityMode} onChange={e=>setJobFormData({...jobFormData, visibilityMode: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-3 bg-white mb-4">
                                    <option value="public">全体に公開 (Public)</option>
                                    <option value="mutual">相互フォローに公開 (Mutual followers)</option>
                                    <option value="followers">フォロワーに公開 (Followers)</option>
                                    <option value="following">フォロー中に公開 (Following)</option>
                                    <option value="private">選択した乗組員のみ (Private / Selected only)</option>
                                </select>

                                <label className="block text-xs font-bold text-brand-700 mb-2 tracking-widest border-t border-brand-200 pt-3">＋ 特定の乗組員を追加して公開</label>
                                <div className="flex gap-2 mb-3">
                                    <input type="text" value={userSearchQuery} onChange={e=>setUserSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchUsers(userSearchQuery); }}} placeholder="ユーザー名やIDで検索" className="flex-1 border border-brand-200 rounded-sm text-sm p-2 bg-white" />
                                    <button type="button" onClick={() => searchUsers(userSearchQuery)} disabled={isSearchingUsers} className="bg-brand-600 text-white px-3 rounded-sm text-sm font-bold tracking-widest hover:bg-brand-700">{isSearchingUsers ? '検索中...' : '検索'}</button>
                                </div>
                                {userSearchResults.length > 0 && (
                                    <div className="border border-brand-200 rounded-sm bg-white overflow-hidden mb-3 max-h-48 overflow-y-auto">
                                        {userSearchResults.map(u => (
                                            <div key={u.uid} className="flex items-center justify-between p-2 border-b border-brand-100 hover:bg-brand-50">
                                                <div className="flex items-center gap-2">
                                                    <img src={u.photoURL || 'https://via.placeholder.com/32?text=User'} alt="user" className="w-6 h-6 rounded-full object-cover" />
                                                    <span className="text-xs font-bold text-brand-800">{u.name || u.userId}</span>
                                                </div>
                                                <button type="button" onClick={() => {
                                                    if (!jobFormData.allowedUsers.includes(u.uid)) {
                                                        setJobFormData({...jobFormData, allowedUsers: [...jobFormData.allowedUsers, u.uid], allowedUserDetails: [...jobFormData.allowedUserDetails, {uid: u.uid, name: u.name || u.userId}]});
                                                    }
                                                    setUserSearchResults(prev => prev.filter(x => x.uid !== u.uid));
                                                }} className="text-[10px] bg-brand-100 text-brand-700 px-2 py-1 rounded-sm tracking-widest font-bold">追加</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {jobFormData.allowedUserDetails.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {jobFormData.allowedUserDetails.map(u => (
                                            <div key={u.uid} className="flex items-center gap-1 bg-white border border-brand-200 px-2 py-1 rounded-full text-xs shadow-sm">
                                                <span className="font-bold text-brand-700">{u.name}</span>
                                                <button type="button" onClick={() => {
                                                    setJobFormData({
                                                        ...jobFormData,
                                                        allowedUsers: jobFormData.allowedUsers.filter(id => id !== u.uid),
                                                        allowedUserDetails: jobFormData.allowedUserDetails.filter(ud => ud.uid !== u.uid)
                                                    });
                                                }} className="text-red-500 hover:text-red-700"><X className="w-3 h-3"/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer-pb" style={{padding:'12px 16px',borderTop:`1px solid rgba(0,0,0,.08)`,background:BG,paddingBottom:'calc(12px + 60px + env(safe-area-inset-bottom))',flexShrink:0}}>
                            <button onClick={submitJob} disabled={submittingJob}
                                style={{width:'100%',background:submittingJob?SAGE:SB,color:LIME,border:'none',borderRadius:12,padding:'13px 0',fontWeight:800,fontSize:13,letterSpacing:'.05em',cursor:'pointer',opacity:submittingJob?.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                                {submittingJob && <Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/>}
                                {submittingJob?'保存中...':(editingJobId?'更新する':'掲載する')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 旧Navbarのボトムナビを完全に非表示（SPA遷移後のゴースト対策） */}
            <style>{`
                /* events ページで旧Navbarのボトムナビを強制非表示 */
                .fixed.bottom-0.w-full.lg\\:hidden[class*="z-\\[1900\\]"],
                nav.fixed.bottom-0.w-full.lg\\:hidden {
                    display: none !important;
                }
                /* モバイル: ヘッダー上部に安全マージン */
                @media(max-width:1023px) {
                    .ev-top-tab-bar {
                        padding-top: calc(env(safe-area-inset-top, 8px) + 12px) !important;
                    }
                }
            `}</style>

        </AppShell>
    );
}

export default function EventsPage() {
    return (
        <Suspense fallback={
            <div style={{minHeight:'100vh',background:'#f8f6f3',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Compass style={{width:40,height:40,animation:'spin .8s linear infinite',color:'#4a7c59',opacity:.7}}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        }>
            <EventsContent />
        </Suspense>
    );
}

'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage, APP_ID } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, where, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Navbar from '@/components/Navbar';
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
        visibilityMode: 'public', allowedUsers: [] as string[], allowedUserDetails: [] as {uid: string, name: string}[]
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
            
            text = `${inviterName}さんからイベント招待が届きました。
■イベントタイトル
　${title}
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
                    allowedUserDetails: ev.allowedUserDetails || []
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
            
            if (e.endTimestamp) {
                if (new Date(e.endTimestamp) < new Date()) return false;
            } else if (e.endDate && e.endTime) {
                if (new Date(`${e.endDate}T${e.endTime}`) < new Date()) return false;
            }

            if (eventTagsFilter.size > 0) {
                const hasTag = e.tags?.some(t => eventTagsFilter.has(t));
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
                    visibilityMode: ev.visibilityMode || 'public', allowedUsers: ev.allowedUsers || [], allowedUserDetails: ev.allowedUserDetails || []
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
                visibilityMode: 'public', allowedUsers: [], allowedUserDetails: []
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

    return (
        <div className="min-h-screen bg-texture flex flex-col pt-16 pb-20 lg:pb-0">
            <Navbar />

            {/* Top View Tabs */}
            <div className="fixed top-16 w-full z-[40] bg-[#fffdf9]/95 backdrop-blur border-b border-brand-200 py-2 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 flex justify-between items-center">
                    <div className="inline-flex bg-brand-50 border border-brand-200 rounded-sm p-1 shadow-inner w-full sm:w-auto">
                        <button onClick={() => setViewMode('map')} className={`tab-btn flex-1 sm:flex-none px-2 sm:px-5 py-2 text-[11px] sm:text-xs font-bold rounded-sm transition-colors tracking-widest font-serif flex items-center justify-center gap-1 whitespace-nowrap ${viewMode === 'map' ? 'bg-[#3e2723] text-[#d4af37] border border-[#b8860b]' : 'text-brand-700 bg-[#fffdf9] border border-transparent'}`}>
                            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> マップ
                        </button>
                        <button onClick={() => setViewMode('list-events')} className={`tab-btn flex-1 sm:flex-none px-2 sm:px-5 py-2 text-[11px] sm:text-xs font-bold rounded-sm transition-colors tracking-widest font-serif flex items-center justify-center gap-1 whitespace-nowrap ${viewMode === 'list-events' ? 'bg-[#3e2723] text-[#d4af37] border border-[#b8860b]' : 'text-brand-700 bg-[#fffdf9] border border-transparent'}`}>
                            <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> イベント
                        </button>
                        <button onClick={() => setViewMode('list-jobs')} className={`tab-btn flex-1 sm:flex-none px-1 sm:px-5 py-2 text-[11px] sm:text-xs font-bold rounded-sm transition-colors tracking-[0.05em] sm:tracking-widest font-serif flex items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap ${viewMode === 'list-jobs' ? 'bg-[#3e2723] text-[#d4af37] border border-[#b8860b]' : 'text-brand-700 bg-[#fffdf9] border border-transparent'}`}>
                            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 仕事・依頼
                        </button>
                    </div>
                    {/* Filter Button */}
                    <button onClick={() => setIsFilterOpen(true)} className="ml-3 p-2 bg-[#fffdf9] border border-brand-200 text-brand-600 hover:bg-brand-50 rounded-sm transition-colors relative shadow-sm flex-shrink-0" title="絞り込み">
                        <Sliders className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            <div className={`fixed top-0 left-0 w-full h-full bg-[#2a1a17]/50 z-[100] transition-opacity duration-300 backdrop-blur-sm ${isFilterOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className={`absolute right-0 top-0 h-full w-80 sm:w-96 bg-[#fffdf9] bg-texture shadow-2xl transform transition-transform duration-300 flex flex-col border-l border-brand-200 ${isFilterOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-4 border-b border-brand-200 flex justify-between items-center bg-[#fffdf9] z-10 relative">
                        <h3 className="font-bold text-lg flex items-center gap-2 text-brand-900 font-serif tracking-widest">
                            <Sliders className="w-5 h-5 text-brand-500" /> {viewMode === 'list-jobs' ? '仕事・依頼の絞り込み' : 'イベントの絞り込み'}
                        </h3>
                        <button onClick={() => setIsFilterOpen(false)} className="p-2 text-brand-400 hover:text-brand-700 rounded-sm hover:bg-brand-50 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    {viewMode !== 'list-jobs' ? (
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            <div>
                                <label className="block text-[11px] font-bold text-brand-500 tracking-widest mb-2"><Calendar className="w-4 h-4 inline mr-1"/>開催時期</label>
                                <select value={eventDateFilter} onChange={e=>setEventDateFilter(e.target.value)} className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-[#fffdf9] focus:outline-none focus:border-brand-500 font-serif tracking-widest">
                                    <option value="all">すべて</option>
                                    <option value="today">今日</option>
                                    <option value="week">1週間以内</option>
                                    <option value="month">1ヶ月以内</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-brand-500 tracking-widest mb-2"><MapPin className="w-4 h-4 inline mr-1"/>開催形式</label>
                                <select value={eventFormatFilter} onChange={e=>setEventFormatFilter(e.target.value)} className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-[#fffdf9] focus:outline-none focus:border-brand-500 font-serif tracking-widest">
                                    <option value="all">すべて</option>
                                    <option value="offline">オフライン（現地）のみ</option>
                                    <option value="online">オンラインのみ</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-brand-500 tracking-widest mb-2"><DollarSign className="w-4 h-4 inline mr-1"/>参加費</label>
                                <select value={eventPriceFilter} onChange={e=>setEventPriceFilter(e.target.value)} className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-[#fffdf9] focus:outline-none focus:border-brand-500 font-serif tracking-widest">
                                    <option value="all">すべて</option>
                                    <option value="free">無料のみ</option>
                                    <option value="paid">有料のみ</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-brand-500 tracking-widest mb-3"><Tags className="w-4 h-4 inline mr-1"/>タグで絞り込み</label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_TAGS.map(tag => (
                                        <label key={tag} className="cursor-pointer">
                                            <input type="checkbox" checked={eventTagsFilter.has(tag)} onChange={() => toggleEventTagFilter(tag)} className="hidden bg-white" />
                                            <div className={`px-2 py-1 rounded-sm border text-xs tracking-widest shadow-sm select-none transition-colors ${eventTagsFilter.has(tag) ? 'bg-[#3e2723] text-[#d4af37] border-[#b8860b]' : 'border-brand-200 text-brand-700 bg-white hover:bg-[#fffdf9]'}`}>{tag}</div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            <div>
                                <label className="block text-[11px] font-bold text-brand-500 tracking-widest mb-2"><Briefcase className="w-4 h-4 inline mr-1"/>募集タイプ</label>
                                <select value={jobTypeFilter} onChange={e=>setJobTypeFilter(e.target.value)} className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-[#fffdf9] focus:outline-none focus:border-brand-500 font-serif tracking-widest">
                                    <option value="">指定なし</option>
                                    <option value="formal_job">求人・業務委託</option>
                                    <option value="casual_request">軽いお願い・お手伝い</option>
                                    <option value="lending">モノ・場所の貸し借り</option>
                                    <option value="member">仲間・パートナー募集</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-brand-500 tracking-widest mb-2"><Briefcase className="w-4 h-4 inline mr-1"/>業種カテゴリ</label>
                                <select value={jobCategoryFilter} onChange={e=>setJobCategoryFilter(e.target.value)} className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-[#fffdf9] focus:outline-none focus:border-brand-500 font-serif tracking-widest">
                                    <option value="">指定なし</option>
                                    <option value="デザイン">デザイン</option>
                                    <option value="エンジニア">エンジニア</option>
                                    <option value="マーケティング">マーケティング</option>
                                    <option value="営業">営業</option>
                                    <option value="動画制作">動画制作</option>
                                    <option value="ライティング">ライティング</option>
                                    <option value="事務・サポート">事務・サポート</option>
                                    <option value="その他">その他</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-brand-500 tracking-widest mb-2"><Building className="w-4 h-4 inline mr-1"/>勤務形態</label>
                                <select value={jobWorkstyleFilter} onChange={e=>setJobWorkstyleFilter(e.target.value)} className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-[#fffdf9] focus:outline-none focus:border-brand-500 font-serif tracking-widest">
                                    <option value="">指定なし</option>
                                    <option value="フルリモート">フルリモート</option>
                                    <option value="一部出社">一部出社</option>
                                    <option value="出社必須">出社必須</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-brand-500 tracking-widest mb-2"><DollarSign className="w-4 h-4 inline mr-1"/>報酬形態</label>
                                <select value={jobRewardFilter} onChange={e=>setJobRewardFilter(e.target.value)} className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-[#fffdf9] focus:outline-none focus:border-brand-500 font-serif tracking-widest">
                                    <option value="">指定なし</option>
                                    <option value="固定報酬">固定報酬</option>
                                    <option value="時給">時給</option>
                                    <option value="月給">月給</option>
                                    <option value="成果報酬">成果報酬</option>
                                    <option value="無償・レベニューシェア">無償・レベニューシェア</option>
                                </select>
                            </div>
                        </div>
                    )}
                    
                    <div className="p-4 border-t border-brand-200 bg-[#f7f5f0] pb-10 sm:pb-4 relative z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <button onClick={() => setIsFilterOpen(false)} className="w-full bg-[#3e2723] text-[#f7f5f0] font-bold py-3.5 rounded-sm hover:bg-[#2a1a17] transition-colors shadow-md tracking-widest border border-[#3e2723]">
                            絞り込みを適用
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="mt-14 w-full flex-1 relative z-0">
                {/* View 1: Map */}
                <div className={`relative w-full h-[calc(100vh-120px)] ${viewMode === 'map' ? 'block' : 'hidden'}`}>
                    {/* Floating Map Search Bar */}
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[30] w-[90%] max-w-md pointer-events-none transition-opacity duration-300">
                        <div className={`relative flex-1 shadow-lg rounded-sm pointer-events-auto border border-brand-200 text-brand-700 ${adjustMode ? 'hidden' : ''}`}>
                            <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-brand-400" />
                            <input 
                                type="text"
                                value={mapSearchText}
                                onChange={(e) => setMapSearchText(e.target.value)}
                                placeholder="イベント・仕事・場所を検索..."
                                className="w-full bg-[#fffdf9]/95 backdrop-blur border-none rounded-sm py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none shadow-sm font-serif tracking-widest"
                            />
                        </div>
                    </div>
                    <div ref={mapRef} className="w-full h-full z-[10]" />

                    {adjustMode && (
                        <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-10 left-1/2 transform -translate-x-1/2 z-[90] w-[90%] max-w-sm pointer-events-auto">
                            <div className="bg-[#fffdf9] p-5 rounded-sm shadow-2xl border-2 border-brand-500 text-center text-brand-900 font-serif">
                                <p className="font-bold mb-3 tracking-widest text-sm"><MapPin className="text-red-500 w-5 h-5 inline mr-2"/>赤色のピンを動かして調整</p>
                                <button onClick={() => {
                                    if (adjustMode === 'event') setEventModalOpen(true);
                                    if (adjustMode === 'job') setJobModalOpen(true);
                                    setAdjustMode(null);
                                }} className="w-full bg-[#3e2723] text-[#d4af37] font-bold py-3 rounded-sm shadow-md tracking-widest text-sm hover:bg-[#2a1a17] border border-[#b8860b]">
                                    位置を決定して戻る
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* View 2: List Events */}
                <div className={`max-w-4xl mx-auto px-4 pt-6 ${viewMode === 'list-events' ? 'block' : 'hidden'}`}>
                    {/* Event List Search Bar */}
                    <div className="mb-6 relative shadow-sm rounded-sm border border-brand-200 bg-white">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-brand-400" />
                        <input 
                            type="text"
                            value={mapSearchText}
                            onChange={(e) => setMapSearchText(e.target.value)}
                            placeholder="イベント・場所を検索..." 
                            className="w-full bg-transparent border-none rounded-sm py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none font-serif tracking-widest"
                        />
                    </div>
                    
                    <div className="flex justify-between items-end mb-6 border-b border-brand-200 pb-2">
                        <h2 className="text-xl font-bold text-brand-900 font-serif tracking-widest">イベント一覧</h2>
                        <span className="text-xs text-brand-500 tracking-widest">{userLocation ? '現在地から近い順' : '新着順'}</span>
                    </div>
                    {isLoading ? (
                        <div className="text-center py-10 text-brand-400">
                            <Compass className="w-10 h-10 animate-spin mx-auto mb-3 opacity-70" />
                            <p className="text-xs tracking-widest font-bold">航海図を読み込み中...</p>
                        </div>
                    ) : (
                        filteredEvents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredEvents.map(ev => (
                                    <div key={ev.id} onClick={() => setSelectedEvent(ev)} className="bg-white border text-brand-800 border-brand-200 rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer flex h-24">
                                        <div className="w-24 shrink-0 bg-brand-100 relative overflow-hidden">
                                            {ev.thumbnailUrl ? (
                                                <img src={ev.thumbnailUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-brand-300 opacity-50" /></div>
                                            )}
                                            <div className="absolute top-1 left-1 flex flex-col gap-1">
                                                {ev.isOnline && <span className="bg-brand-800 text-white text-[8px] px-1.5 py-0.5 rounded-sm font-bold tracking-widest shadow-sm text-center">オンライン</span>}
                                                {Number(ev.price) === 0 && <span className="bg-[#b8860b] text-[#fffdf9] text-[8px] px-1.5 py-0.5 rounded-sm font-bold tracking-widest shadow-sm text-center">無料</span>}
                                            </div>
                                        </div>
                                        <div className="p-2 flex-1 flex flex-col justify-between min-w-0">
                                            <h3 className="font-bold text-brand-900 line-clamp-2 text-sm leading-tight tracking-widest">{ev.title}</h3>
                                            <div>
                                                <div className="flex items-center text-[10px] text-brand-500 gap-1 truncate">
                                                    <Calendar className="w-3 h-3 shrink-0"/> {ev.startDate} <span className="hidden sm:inline">{ev.startTime} 〜</span>
                                                </div>
                                                <div className="flex items-center justify-between mt-0.5">
                                                    <div className="flex items-center text-[10px] text-brand-500 gap-1 truncate max-w-[70%]">
                                                        <MapPin className="w-3 h-3 shrink-0"/> {ev.isOnline ? ev.locationName : (ev.locationName || '未設定')}
                                                    </div>
                                                    {!ev.isOnline && ev.lat && ev.lng && userLocation && (
                                                        <span className="text-brand-600 px-1 py-0.5 rounded-sm text-[9px] font-bold shadow-sm whitespace-nowrap bg-brand-50">
                                                            <Compass className="w-2.5 h-2.5 inline mr-0.5" />{calculateDistance(userLocation.lat, userLocation.lng, ev.lat, ev.lng).toFixed(1)}km
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-brand-400">
                                <p className="text-sm font-bold tracking-widest">条件に合うイベントが見つかりません。</p>
                            </div>
                        )
                    )}
                </div>

                {/* View 3: List Jobs */}
                <div className={`max-w-4xl mx-auto px-4 pt-6 ${viewMode === 'list-jobs' ? 'block' : 'hidden'}`}>
                    {/* Job List Search Bar */}
                    <div className="mb-6 relative shadow-sm rounded-sm border border-brand-200 bg-white">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-brand-400" />
                        <input 
                            type="text"
                            value={mapSearchText}
                            onChange={(e) => setMapSearchText(e.target.value)}
                            placeholder="仕事・依頼を検索..." 
                            className="w-full bg-transparent border-none rounded-sm py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none font-serif tracking-widest"
                        />
                    </div>

                    <div className="flex justify-between items-end mb-6 border-b border-brand-200 pb-2">
                        <h2 className="text-xl font-bold text-brand-900 font-serif tracking-widest">仕事・依頼一覧</h2>
                        <span className="text-xs text-brand-500 tracking-widest">新着順</span>
                    </div>
                    {isLoading ? (
                        <div className="text-center py-10 text-brand-400">
                            <Compass className="w-10 h-10 animate-spin mx-auto mb-3 opacity-70" />
                            <p className="text-xs tracking-widest font-bold">依頼書を探しています...</p>
                        </div>
                    ) : (
                        filteredJobs.length > 0 ? (
                            <div className="space-y-4">
                                {filteredJobs.map(job => (
                                    <div key={job.id} className="bg-white border text-brand-800 border-brand-200 rounded-sm p-4 hover:bg-brand-50 transition-colors shadow-sm cursor-pointer relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-sm tracking-widest border border-brand-200">
                                                {job.listingType === 'casual_request' ? 'お手伝い' : (job.listingType === 'lending' ? '貸し借り' : (job.listingType === 'member' ? 'メンバー募集' : (job.type || '業務委託')))}
                                            </span>
                                            {job.listingType === 'formal_job' && job.category && <span className="text-[10px] text-brand-400 tracking-widest font-medium"><Briefcase className="w-3 h-3 inline mr-1"/> {job.category}</span>}
                                        </div>
                                        <h3 className="font-bold text-brand-900 text-base leading-tight mb-2 tracking-widest font-serif pr-16">{job.title}</h3>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                                            {job.listingType !== 'lending' && job.rewardType && (
                                                <div className="flex items-center text-[11px] text-brand-600 font-bold bg-green-50 px-1 py-0.5"><DollarSign className="w-3 h-3 mr-1 text-green-600"/> <span className="text-green-700">{job.rewardType}：{job.rewardAmount || '応相談'}</span></div>
                                            )}
                                            {(job.listingType === 'formal_job' || job.listingType === 'member') && job.workStyle && (
                                                <div className="flex items-center text-[10px] text-brand-500"><Building className="w-3 h-3 mr-1"/> {job.workStyle}</div>
                                            )}
                                            <div className="flex items-center text-[10px] text-brand-500"><Calendar className="w-3 h-3 mr-1"/> {job.period || '単発'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-brand-400">
                                <p className="text-sm font-bold tracking-widest">条件に合う仕事・依頼が見つかりません。</p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Create FAB & Menu */}
            <div className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-10 right-5 z-[50] flex flex-col items-end ${adjustMode ? 'hidden' : ''}`}>
                <div className={`mb-3 bg-[#fffdf9] border border-brand-300 shadow-xl rounded-sm p-2 flex flex-col gap-1 w-48 transition-all origin-bottom-right ${isCreateMenuOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'}`}>
                    <button onClick={() => openEventModal()} className="text-left px-3 py-3 hover:bg-brand-50 rounded-sm text-sm font-bold text-brand-900 tracking-widest border-b border-brand-100 flex items-center gap-2">
                        <ImageIcon className="text-brand-500 w-5 h-5" /> <span>イベントを企画</span>
                    </button>
                    <button onClick={() => openJobModal()} className="text-left px-3 py-3 hover:bg-brand-50 rounded-sm text-sm font-bold text-brand-900 tracking-widest flex items-center gap-2 group">
                        <Briefcase className="text-blue-500 w-5 h-5" /> <span className="flex-1">仕事・依頼を掲載</span>
                        <span title="BUILDER以上限定" className="flex items-center justify-center"><Lock className="text-brand-300 w-3 h-3 group-hover:text-brand-500" /></span>
                    </button>
                </div>
                <button onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} className="w-14 h-14 bg-[#3e2723] text-[#d4af37] rounded-full shadow-2xl flex items-center justify-center hover:bg-[#2a1a17] hover:scale-105 transition-all border-2 border-[#b8860b]">
                    <CirclePlus className={`w-8 h-8 transition-transform duration-300 ${isCreateMenuOpen ? 'rotate-45' : ''}`} />
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
                onShare={(evt: any) => shareItem(evt, 'event')}
                hideEventLink={true}
            />

            {/* Job Detail Sheet (placeholder) */}
            <div className={`detail-sheet fixed bottom-0 left-0 w-full z-[80] bg-[#fffdf9] border-t border-brand-300 rounded-t-xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-24 max-h-[90dvh] overflow-y-auto lg:top-16 lg:bottom-auto lg:left-auto lg:right-0 lg:w-[450px] lg:h-[calc(100vh-64px)] lg:max-h-none lg:rounded-none lg:border-t-0 lg:border-l lg:pb-0 bg-texture transition-transform duration-300 ${selectedJob && !adjustMode ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full'}`}>
                <div className="sticky top-0 bg-[#fffdf9]/95 backdrop-blur z-20 pt-3 pb-2 flex justify-center border-b border-brand-100 lg:pt-4 lg:pb-4 cursor-pointer" onClick={() => setSelectedJob(null)}>
                    <div className="w-12 h-1 bg-brand-300 rounded-full lg:hidden"></div>
                    <div className="hidden lg:flex w-full justify-between items-center px-5">
                        <span className="text-xs font-bold text-brand-500 tracking-widest">仕事・依頼 詳細</span>
                        <X className="w-5 h-5 text-brand-400 hover:text-brand-700" />
                    </div>
                </div>
                <div className="px-5 pb-20 lg:pb-8 pt-4">
                    {selectedJob && (
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2.5 py-1 rounded-sm tracking-widest border border-brand-200">{selectedJob.type}</span>
                                <span className="text-xs text-brand-500 font-bold tracking-widest"><Briefcase className="w-3.5 h-3.5 inline mr-1"/>{selectedJob.category}</span>
                            </div>
                            
                            <h2 className="text-xl sm:text-2xl font-bold text-brand-900 font-serif mb-4 tracking-widest leading-tight">{selectedJob.title}</h2>
                            
                            <div className="bg-brand-50 border border-brand-100 p-4 rounded-sm space-y-3 mb-6">
                                <div className="flex justify-between items-start border-b border-brand-200 pb-2">
                                    <span className="text-xs font-bold text-brand-500 tracking-widest"><Building className="w-4 h-4 inline mr-1 text-brand-400"/>勤務形態</span>
                                    <span className="text-sm font-bold text-brand-900 text-right">{selectedJob.workStyle} <span className="block text-brand-400 text-xs font-normal mt-0.5">{selectedJob.location}</span></span>
                                </div>
                                <div className="flex justify-between items-center border-b border-brand-200 pb-2">
                                    <span className="text-xs font-bold text-brand-500 tracking-widest"><DollarSign className="w-4 h-4 inline mr-1 text-green-500"/>報酬</span>
                                    <span className="text-sm font-bold text-green-700">{selectedJob.rewardType}：{selectedJob.rewardAmount || '応相談'}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-brand-200 pb-2">
                                    <span className="text-xs font-bold text-brand-500 tracking-widest"><Calendar className="w-4 h-4 inline mr-1 text-brand-400"/>期間・納期</span>
                                    <span className="text-sm font-bold text-brand-900">{selectedJob.period}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-brand-500 tracking-widest"><User className="w-4 h-4 inline mr-1 text-brand-400"/>投稿者</span>
                                    <Link href={`/user?uid=${selectedJob.organizerId}`} className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline">{selectedJob.organizerName}</Link>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-brand-800 mb-2 tracking-widest border-l-2 border-blue-500 pl-2 font-serif">業務詳細</h3>
                                <div className="text-brand-700 text-sm leading-relaxed whitespace-pre-wrap markdown-body" dangerouslySetInnerHTML={{ __html: formatText(selectedJob.desc) }} />
                            </div>

                            {(selectedJob.skills || selectedJob.flow || selectedJob.company || selectedJob.url) && (
                                <div className="mb-6 space-y-4 border-t border-brand-200 pt-5">
                                    {selectedJob.skills && (
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-500 mb-1 tracking-widest">必須・歓迎スキル</h4>
                                            <p className="text-sm text-brand-800 whitespace-pre-wrap">{selectedJob.skills}</p>
                                        </div>
                                    )}
                                    {selectedJob.flow && (
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-500 mb-1 tracking-widest">選考フロー</h4>
                                            <p className="text-sm text-brand-800 whitespace-pre-wrap">{selectedJob.flow}</p>
                                        </div>
                                    )}
                                    {selectedJob.url && (
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-500 mb-1 tracking-widest">関連URL</h4>
                                            <a href={selectedJob.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 underline break-all">{selectedJob.url}</a>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 flex flex-col gap-3">
                                {selectedJob.organizerId !== user?.uid && (
                                    <button disabled className="w-full py-3.5 bg-[#4a6b8c] text-white rounded-sm text-sm font-bold tracking-widest shadow-md border border-[#304860] opacity-50 cursor-not-allowed text-center">
                                        応募・連絡する (準備中)
                                    </button>
                                )}
                                {(userData?.userId === 'admin' || userData?.uid === selectedJob.organizerId) && (
                                    <button onClick={() => { setSelectedJob(null); openJobModal(selectedJob.id); }} className="w-full py-2.5 bg-[#f7f5f0] border border-brand-300 text-brand-700 rounded-sm text-xs font-bold tracking-widest hover:bg-white transition-colors shadow-sm">募集内容を編集する</button>
                                )}
                                <button onClick={() => shareItem(selectedJob, 'job')} className="w-full mt-2 py-2.5 bg-brand-50 border border-brand-200 text-brand-600 rounded-sm text-xs font-bold tracking-widest hover:bg-brand-100 transition-colors shadow-sm flex justify-center items-center gap-2"><Share2 className="w-4 h-4" />募集を共有する (リンクコピー)</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Event Modal */}
            {eventModalOpen && (
                <div className="fixed inset-0 z-[120] bg-[#2a1a17]/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
                    <div className="bg-[#fffdf9] bg-texture w-full sm:w-[600px] h-[90dvh] sm:h-[90vh] rounded-t-sm sm:rounded-sm shadow-2xl flex flex-col border border-brand-300">
                        <div className="p-4 border-b border-brand-200 flex justify-between items-center flex-shrink-0 bg-[#fffdf9]">
                            <h3 className="font-bold text-lg text-brand-900 font-serif tracking-widest">{editingEventId ? 'イベントを編集' : 'イベントを企画'}</h3>
                            <button onClick={() => setEventModalOpen(false)} className="p-2 text-brand-400 hover:text-brand-700"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-2 tracking-widest">画像 (最大5枚)</label>
                                <input type="file" multiple accept="image/*" onChange={(e) => {
                                    if (e.target.files) {
                                        const newFiles = Array.from(e.target.files).slice(0, 5 - eventFiles.length - eventOldImages.length);
                                        const previewMapped = newFiles.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
                                        setEventFiles(prev => [...prev, ...previewMapped]);
                                    }
                                }} className="mb-3 text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-bold file:bg-[#3e2723] file:text-[#d4af37] hover:file:bg-[#2a1a17]" />
                                <div className="flex gap-2 flex-wrap mb-2">
                                    {eventOldImages.map((url, i) => (
                                        <div key={`old-${i}`} className="relative w-16 h-16 border rounded-sm overflow-hidden shadow-sm">
                                            <img src={url} className="w-full h-full object-cover" />
                                            <button onClick={() => setEventOldImages(prev => prev.filter((_, idx) => idx !== i))} type="button" className="absolute top-0 right-0 bg-red-500/90 hover:bg-red-600 text-white rounded-bl-sm p-1 backdrop-blur-sm"><X className="w-3 h-3"/></button>
                                        </div>
                                    ))}
                                    {eventFiles.map((item, i) => (
                                        <div key={`new-${i}`} className="relative w-16 h-16 border rounded-sm overflow-hidden shadow-sm">
                                            <img src={item.preview} className="w-full h-full object-cover" />
                                            <button onClick={() => setEventFiles(prev => prev.filter((_, idx) => idx !== i))} type="button" className="absolute top-0 right-0 bg-red-500/90 hover:bg-red-600 text-white rounded-bl-sm p-1 backdrop-blur-sm"><X className="w-3 h-3"/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-2 tracking-widest">イベント名 <span className="text-red-500">*</span></label>
                                <input type="text" value={eventFormData.title} onChange={e=>setEventFormData({...eventFormData, title: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-3 bg-white" placeholder="例: 週末朝活コーヒー会" required />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-brand-700 mb-2 tracking-widest">参加費 (円)</label>
                                    <input type="number" value={eventFormData.price} onChange={e=>setEventFormData({...eventFormData, price: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-3 bg-white" placeholder="0で無料" min="0" step="100" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-2 tracking-widest">関連タグ</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {PRESET_TAGS.map(tag => (
                                        <button key={tag} type="button" onClick={() => {
                                            const newTags = new Set(eventSelectedTags);
                                            if (newTags.has(tag)) newTags.delete(tag);
                                            else newTags.add(tag);
                                            setEventSelectedTags(newTags);
                                        }} className={`px-3 py-1.5 rounded-sm text-xs border transition-colors shadow-sm ${eventSelectedTags.has(tag) ? 'bg-[#3e2723] text-[#d4af37] border-[#b8860b] font-bold' : 'bg-white text-brand-600 border-brand-200 hover:bg-brand-50'}`}>
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                <input type="text" value={eventCustomTags} onChange={e=>setEventCustomTags(e.target.value)} className="w-full border border-brand-200 rounded-sm text-xs p-3 bg-white" placeholder="独自のカスタムタグ (カンマ区切り)" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 bg-brand-50 p-4 rounded-sm border border-brand-200">
                                <div>
                                    <span className="block text-xs font-bold text-brand-500 mb-2">開始 <span className="text-red-500">*</span></span>
                                    <input type="date" value={eventFormData.startDate} onChange={e=>setEventFormData({...eventFormData, startDate: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white mb-2" required />
                                    <input type="time" value={eventFormData.startTime} onChange={e=>setEventFormData({...eventFormData, startTime: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" required />
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-brand-500 mb-2">終了 <span className="text-red-500">*</span></span>
                                    <input type="date" value={eventFormData.endDate} onChange={e=>setEventFormData({...eventFormData, endDate: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white mb-2" required />
                                    <input type="time" value={eventFormData.endTime} onChange={e=>setEventFormData({...eventFormData, endTime: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" required />
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
                            </div>
                            
                            {userData?.userId === 'admin' && (
                                <div className="bg-red-50 p-4 rounded-sm border border-red-200 mt-4 shadow-inner">
                                    <h4 className="text-xs font-bold text-red-600 mb-2 tracking-widest">【管理者専用】代理投稿</h4>
                                    <input type="text" value={(eventFormData as any).overrideUserId || ''} onChange={e=>setEventFormData({...eventFormData, overrideUserId: e.target.value} as any)} className="w-full border-red-200 rounded-sm text-sm p-2 bg-white" placeholder="代理投稿する場合のユーザーID (uid)" />
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-brand-200 bg-[#f7f5f0] pb-24 sm:pb-4 flex-shrink-0">
                            <button onClick={submitEvent} disabled={submittingEvent} className="w-full bg-[#3e2723] text-[#f7f5f0] font-bold py-3.5 rounded-sm hover:bg-[#2a1a17] transition-colors shadow-md tracking-widest border border-[#b8860b] disabled:opacity-50">
                                {submittingEvent ? '保存中...' : (editingEventId ? '更新する' : '企画する')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Job Modal */}
            {jobModalOpen && (
                <div className="fixed inset-0 z-[120] bg-[#2a1a17]/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
                    <div className="bg-[#fffdf9] bg-texture w-full sm:w-[650px] h-[90dvh] sm:h-[90vh] rounded-t-sm sm:rounded-sm shadow-2xl flex flex-col border border-brand-300">
                        <div className="p-4 border-b border-brand-200 flex justify-between items-center flex-shrink-0 bg-[#fffdf9]">
                            <h3 className="font-bold text-lg text-brand-900 font-serif tracking-widest">{editingJobId ? '仕事・依頼を編集' : '仕事・依頼を掲載'}</h3>
                            <button onClick={() => setJobModalOpen(false)} className="p-2 text-brand-400 hover:text-brand-700"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-1 tracking-widest">募集タイプ</label>
                                <select value={jobFormData.listingType} onChange={e=>setJobFormData({...jobFormData, listingType: e.target.value})} className="w-full border border-brand-300 rounded-sm text-sm p-3 bg-brand-50 mb-2 font-bold text-brand-900 border-l-4 border-l-[#b8860b] shadow-sm tracking-widest">
                                    <option value="formal_job">求人・業務委託</option>
                                    <option value="casual_request">軽いお願い・お手伝い</option>
                                    <option value="lending">モノや場所の貸し借り</option>
                                    <option value="member">仲間・パートナー募集</option>
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

                            {jobFormData.listingType === 'formal_job' && (
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
                                            <option value="動画制作">動画制作</option>
                                            <option value="ライティング">ライティング</option>
                                            <option value="事務・サポート">事務・サポート</option>
                                            <option value="その他">その他</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {(jobFormData.listingType === 'formal_job' || jobFormData.listingType === 'member') && (
                                <div>
                                    <label className="block text-xs font-bold text-brand-700 mb-1 tracking-widest">必須・歓迎スキル</label>
                                    <input type="text" value={jobFormData.skills} onChange={e=>setJobFormData({...jobFormData, skills: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder="例: Figma, React等の経験" />
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
                        <div className="p-4 border-t border-brand-200 bg-[#f7f5f0] pb-24 sm:pb-4 flex-shrink-0">
                            <button onClick={submitJob} disabled={submittingJob} className="w-full bg-[#3e2723] text-[#f7f5f0] font-bold py-3.5 rounded-sm hover:bg-[#2a1a17] transition-colors shadow-md tracking-widest border border-[#3e2723] disabled:opacity-50">
                                {submittingJob ? '保存中...' : (editingJobId ? '更新する' : '掲載する')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default function EventsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-texture pb-20 flex flex-col">
                <div className="flex-1 flex items-center justify-center pt-20">
                    <Compass className="w-10 h-10 animate-spin text-brand-400 opacity-70" />
                </div>
            </div>
        }>
            <EventsContent />
        </Suspense>
    );
}

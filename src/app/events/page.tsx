'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, where, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Navbar from '@/components/Navbar';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Anchor, Compass, Hourglass, Ship, User, Image as ImageIcon, Check, MapPin, List, Briefcase, Sliders, X, CirclePlus, Tags, Lock, Building, DollarSign, Calendar, Search } from 'lucide-react';
import Script from 'next/script';

const PRESET_TAGS = ["交流会", "勉強会", "スポーツ", "音楽", "アート", "グルメ", "アウトドア", "ビジネス", "初心者歓迎", "オンライン"];
const APP_ID = 'noah-client';

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
    createdAt?: any;
    updatedAt?: any;
};

type JobData = {
    id: string;
    title: string;
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
    createdAt?: any;
    updatedAt?: any;
};

function EventsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const [userData, setUserData] = useState<any>(null);

    const [viewMode, setViewMode] = useState<'map' | 'list-events' | 'list-jobs'>('map');
    const [isLoading, setIsLoading] = useState(true);
    
    const [allEvents, setAllEvents] = useState<EventData[]>([]);
    const [allJobs, setAllJobs] = useState<JobData[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<EventData[]>([]);
    const [filteredJobs, setFilteredJobs] = useState<JobData[]>([]);

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
    const [theaterMenuOpen, setTheaterMenuOpen] = useState(false);

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
    
    // Create/Edit Event State
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [eventFormData, setEventFormData] = useState({
        title: '', price: '0', startDate: '', startTime: '', endDate: '', endTime: '', desc: '',
        isOnline: false, onlineTool: '', onlineUrl: '', locationName: '', locationQuery: '', participantPublic: true
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
        title: '', type: '業務委託', category: 'デザイン', desc: '', rewardType: '固定報酬', rewardAmount: '',
        period: '単発', workStyle: 'フルリモート', locationQuery: '', locationName: '', skills: '', deadline: '',
        flow: '面談1回', company: '', url: ''
    });
    const [submittingJob, setSubmittingJob] = useState(false);

    // Map Adjust State
    const [adjustMode, setAdjustMode] = useState<'event' | 'job' | null>(null);
    const [adjustCoords, setAdjustCoords] = useState<{lat: number, lng: number} | null>(null);
    const tempMarkerRef = useRef<any>(null);

    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMap = useRef<any>(null);
    const markersRef = useRef<any[]>([]);

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
        filterData();
    }, [allEvents, allJobs, mapSearchText, eventDateFilter, eventFormatFilter, eventPriceFilter, eventTagsFilter, jobTypeFilter, jobCategoryFilter, jobWorkstyleFilter, jobRewardFilter]);

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
            
            if (eventTagsFilter.size > 0) {
                const hasTag = e.tags?.some(t => eventTagsFilter.has(t));
                if (!hasTag) return false;
            }
            return true;
        });

        let jList = allJobs.filter(j => {
            if (queryText && 
                !((j.title?.toLowerCase().includes(queryText)) || 
                  (j.desc?.toLowerCase().includes(queryText)) ||
                  (j.company?.toLowerCase().includes(queryText)))) {
                return false;
            }
            if (jobTypeFilter && j.type !== jobTypeFilter) return false;
            if (jobCategoryFilter && j.category !== jobCategoryFilter) return false;
            if (jobWorkstyleFilter && j.workStyle !== jobWorkstyleFilter) return false;
            if (jobRewardFilter && j.rewardType !== jobRewardFilter) return false;
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
                leafletMap.current = L.map(mapRef.current).setView([35.681236, 139.767125], 5);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
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
        if (editId) {
            const ev = allEvents.find(e => e.id === editId);
            if (ev) {
                setEditingEventId(editId);
                setEventFormData({
                    title: ev.title, price: ev.price.toString(), startDate: ev.startDate || '',
                    startTime: ev.startTime || '', endDate: ev.endDate || '', endTime: ev.endTime || '', desc: ev.description || '',
                    isOnline: !!ev.isOnline, onlineTool: ev.locationName?.replace('オンライン (', '')?.replace(')', '') || '',
                    onlineUrl: ev.onlineUrl || '', locationName: ev.locationName || '', locationQuery: '', participantPublic: ev.isParticipantsPublic !== false
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
                isOnline: false, onlineTool: '', onlineUrl: '', locationName: '', locationQuery: '', participantPublic: true
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
        if (!userData || (userData.membershipRank !== 'covenant' && userData.membershipRank !== 'guardian' && userData.membershipRank !== 'builder' && userData.userId !== 'admin')) {
            alert('仕事・依頼の掲載は BUILDER 以上の機能です。契約変更をご検討ください。');
            return;
        }
        if (editId) {
            const j = allJobs.find(x => x.id === editId);
            if (j) {
                setEditingJobId(editId);
                setJobFormData({
                    title: j.title, type: j.type || '業務委託', category: j.category || 'デザイン', desc: j.desc || '',
                    rewardType: j.rewardType || '固定報酬', rewardAmount: j.rewardAmount || '', period: j.period || '単発',
                    workStyle: j.workStyle || 'フルリモート', locationQuery: '', locationName: j.location || '',
                    skills: j.skills || '', deadline: j.deadline || '', flow: j.flow || '面談1回', company: j.company || '', url: j.url || ''
                });
                if (j.lat && j.lng) setAdjustCoords({ lat: j.lat, lng: j.lng });
                else setAdjustCoords(null);
            }
        } else {
            setEditingJobId(null);
            setJobFormData({
                title: '', type: '業務委託', category: 'デザイン', desc: '', rewardType: '固定報酬', rewardAmount: '',
                period: '単発', workStyle: 'フルリモート', locationQuery: '', locationName: '', skills: '', deadline: '',
                flow: '面談1回', company: '', url: ''
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
            if (editingEventId) {
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
                isParticipantsPublic: eventFormData.participantPublic, updatedAt: serverTimestamp()
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
                await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'events'), evtData);
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
                title: jobFormData.title, type: jobFormData.type, category: jobFormData.category, desc: jobFormData.desc,
                rewardType: jobFormData.rewardType, rewardAmount: jobFormData.rewardAmount, period: jobFormData.period,
                workStyle: jobFormData.workStyle, location: jobFormData.locationName, skills: jobFormData.skills,
                deadline: jobFormData.deadline, flow: jobFormData.flow, company: jobFormData.company, url: jobFormData.url,
                organizerId: finalOrganizerId, organizerName: finalOrganizerName, organizerAvatar: finalOrganizerAvatar,
                updatedAt: serverTimestamp()
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
                await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'jobs'), jbData);
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
        const isJoined = evt.participants?.includes(user.uid);
        try {
            const evtRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', evt.id);
            const userJoinRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'participating_events', evt.id);
            if (isJoined) {
                await updateDoc(evtRef, { participants: arrayRemove(user.uid), participantCount: (evt.participantCount || 1) - 1 });
                await deleteDoc(userJoinRef);
                setSelectedEvent({ ...evt, participants: evt.participants?.filter(u => u !== user.uid), participantCount: (evt.participantCount || 1) - 1 });
                // Also update allEvents state so map/list knows
                setAllEvents(prev => prev.map(e => e.id === evt.id ? { ...e, participants: e.participants?.filter(u => u !== user.uid) || [], participantCount: (e.participantCount || 1) - 1 } : e));
                alert('参加をキャンセルしました。');
            } else {
                await updateDoc(evtRef, { participants: arrayUnion(user.uid), participantCount: (evt.participantCount || 0) + 1 });
                await setDoc(userJoinRef, { joinedAt: serverTimestamp() });
                const newParts = [...(evt.participants || []), user.uid];
                setSelectedEvent({ ...evt, participants: newParts, participantCount: (evt.participantCount || 0) + 1 });
                setAllEvents(prev => prev.map(e => e.id === evt.id ? { ...e, participants: newParts, participantCount: (e.participantCount || 0) + 1 } : e));
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
                        <button onClick={() => setViewMode('map')} className={`tab-btn flex-1 sm:flex-none px-3 sm:px-5 py-2 text-xs font-bold rounded-sm transition-colors tracking-widest font-serif flex items-center justify-center gap-1 ${viewMode === 'map' ? 'bg-[#3e2723] text-[#d4af37] border border-[#b8860b]' : 'text-brand-700 bg-[#fffdf9] border border-transparent'}`}>
                            <MapPin className="w-4 h-4" /> マップ
                        </button>
                        <button onClick={() => setViewMode('list-events')} className={`tab-btn flex-1 sm:flex-none px-3 sm:px-5 py-2 text-xs font-bold rounded-sm transition-colors tracking-widest font-serif flex items-center justify-center gap-1 ${viewMode === 'list-events' ? 'bg-[#3e2723] text-[#d4af37] border border-[#b8860b]' : 'text-brand-700 bg-[#fffdf9] border border-transparent'}`}>
                            <List className="w-4 h-4" /> イベント
                        </button>
                        <button onClick={() => setViewMode('list-jobs')} className={`tab-btn flex-1 sm:flex-none px-3 sm:px-5 py-2 text-xs font-bold rounded-sm transition-colors tracking-widest font-serif flex items-center justify-center gap-1 ${viewMode === 'list-jobs' ? 'bg-[#3e2723] text-[#d4af37] border border-[#b8860b]' : 'text-brand-700 bg-[#fffdf9] border border-transparent'}`}>
                            <Briefcase className="w-4 h-4" /> 仕事・依頼
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
                                    <option value="業務委託">業務委託</option>
                                    <option value="正社員">正社員</option>
                                    <option value="契約社員">契約社員</option>
                                    <option value="アルバイト">アルバイト</option>
                                    <option value="単発依頼">単発依頼</option>
                                    <option value="共同事業パートナー">共同事業パートナー</option>
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
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[30] w-[90%] max-w-md pointer-events-none">
                        <div className={`relative flex-1 shadow-lg rounded-sm pointer-events-auto border border-brand-200 text-brand-700 ${adjustMode ? 'hidden' : ''}`}>
                            <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-brand-400" />
                            <input 
                                type="text"
                                value={mapSearchText}
                                onChange={(e) => setMapSearchText(e.target.value)}
                                placeholder="イベントや仕事を検索..." 
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
                    <div className="flex justify-between items-end mb-6 border-b border-brand-200 pb-2">
                        <h2 className="text-xl font-bold text-brand-900 font-serif tracking-widest">イベント一覧</h2>
                        <span className="text-xs text-brand-500 tracking-widest">新着順</span>
                    </div>
                    {isLoading ? (
                        <div className="text-center py-10 text-brand-400">
                            <Compass className="w-10 h-10 animate-spin mx-auto mb-3 opacity-70" />
                            <p className="text-xs tracking-widest font-bold">航海図を読み込み中...</p>
                        </div>
                    ) : (
                        filteredEvents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredEvents.map(ev => (
                                    <div key={ev.id} className="bg-white border text-brand-800 border-brand-200 rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                                        <div className="h-32 bg-brand-100 relative overflow-hidden">
                                            {ev.thumbnailUrl ? (
                                                <img src={ev.thumbnailUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-10 h-10 text-brand-300 opacity-50" /></div>
                                            )}
                                            <div className="absolute top-2 left-2 flex gap-1">
                                                {ev.isOnline && <span className="bg-brand-800 text-white text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-widest shadow-sm">オンライン</span>}
                                                {Number(ev.price) === 0 ? <span className="bg-[#b8860b] text-[#fffdf9] text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-widest shadow-sm">無料</span> : null}
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <h3 className="font-bold text-brand-900 line-clamp-2 text-sm leading-tight mb-2 tracking-widest">{ev.title}</h3>
                                            <div className="flex items-center text-[10px] text-brand-500 mb-1 gap-1">
                                                <Calendar className="w-3 h-3"/> {ev.startDate} {ev.startTime} 〜
                                            </div>
                                            <div className="flex items-center text-[10px] text-brand-500 gap-1 truncate">
                                                <MapPin className="w-3 h-3 shrink-0"/> {ev.isOnline ? ev.locationName : (ev.locationName || '場所未設定')}
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
                                            <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-sm tracking-widest border border-brand-200">{job.type}</span>
                                            <span className="text-[10px] text-brand-400 tracking-widest font-medium"><Briefcase className="w-3 h-3 inline mr-1"/> {job.category}</span>
                                        </div>
                                        <h3 className="font-bold text-brand-900 text-base leading-tight mb-2 tracking-widest font-serif pr-16">{job.title}</h3>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                                            <div className="flex items-center text-[11px] text-brand-600 font-bold bg-green-50 px-1 py-0.5"><DollarSign className="w-3 h-3 mr-1 text-green-600"/> <span className="text-green-700">{job.rewardType}：{job.rewardAmount || '応相談'}</span></div>
                                            <div className="flex items-center text-[10px] text-brand-500"><Building className="w-3 h-3 mr-1"/> {job.workStyle}</div>
                                            <div className="flex items-center text-[10px] text-brand-500"><Calendar className="w-3 h-3 mr-1"/> {job.period}</div>
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
            {/* Event Detail Sheet (placeholder for full implementation) */}
            <div className={`detail-sheet fixed bottom-0 left-0 w-full z-[80] bg-[#fffdf9] border-t border-brand-300 rounded-t-xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-safe-bottom max-h-[90vh] overflow-y-auto lg:top-16 lg:bottom-auto lg:left-auto lg:right-0 lg:w-[450px] lg:h-[calc(100vh-64px)] lg:max-h-none lg:rounded-none lg:border-t-0 lg:border-l lg:pb-0 bg-texture transition-transform duration-300 ${selectedEvent && !adjustMode ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full'}`}>
                <div className="sticky top-0 bg-[#fffdf9]/95 backdrop-blur z-20 pt-3 pb-2 flex justify-center border-b border-brand-100 lg:pt-4 lg:pb-4 cursor-pointer" onClick={() => setSelectedEvent(null)}>
                    <div className="w-12 h-1 bg-brand-300 rounded-full lg:hidden"></div>
                    <div className="hidden lg:flex w-full justify-between items-center px-5">
                        <span className="text-xs font-bold text-brand-500 tracking-widest">イベント詳細</span>
                        <X className="w-5 h-5 text-brand-400 hover:text-brand-700" />
                    </div>
                </div>
                <div className="px-5 pb-20 lg:pb-8 pt-4">
                    {selectedEvent && (
                        <div>
                            {selectedEvent.thumbnailUrl && <img src={selectedEvent.thumbnailUrl} className="w-full h-48 sm:h-64 object-cover rounded-sm border border-brand-200 mb-5 shadow-sm" />}
                            
                            <div className="flex flex-wrap gap-2 mb-3">
                                {selectedEvent.isOnline && <span className="bg-brand-800 text-white text-xs px-2.5 py-1 rounded-sm font-bold tracking-widest shadow-sm">オンライン</span>}
                                {Number(selectedEvent.price) === 0 ? <span className="bg-[#b8860b] text-[#fffdf9] text-xs px-2.5 py-1 rounded-sm font-bold tracking-widest shadow-sm">無料</span> : <span className="border border-[#b8860b] text-[#b8860b] bg-white text-xs px-2.5 py-1 rounded-sm font-bold tracking-widest shadow-sm">¥{selectedEvent.price}</span>}
                            </div>
                            
                            <h2 className="text-xl sm:text-2xl font-bold text-brand-900 font-serif mb-4 tracking-widest leading-tight">{selectedEvent.title}</h2>
                            
                            <div className="bg-brand-50 border border-brand-100 p-4 rounded-sm space-y-3 mb-6">
                                <div className="flex justify-between items-start border-b border-brand-200 pb-2">
                                    <span className="text-xs font-bold text-brand-500 tracking-widest mt-0.5"><Calendar className="w-4 h-4 inline mr-1 text-brand-400"/>日時</span>
                                    <div className="text-sm font-bold text-brand-900 text-right">
                                        {selectedEvent.startDate} {selectedEvent.startTime}<br/>
                                        <span className="text-brand-400 font-normal text-xs">〜 {selectedEvent.endDate} {selectedEvent.endTime}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-start border-b border-brand-200 pb-2">
                                    <span className="text-xs font-bold text-brand-500 tracking-widest mt-0.5"><MapPin className="w-4 h-4 inline mr-1 text-brand-400"/>場所</span>
                                    <div className="text-sm font-bold text-brand-900 text-right">
                                        {selectedEvent.locationName || '未設定'}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-brand-500 tracking-widest"><User className="w-4 h-4 inline mr-1 text-brand-400"/>主催者</span>
                                    <span className="text-sm font-bold text-brand-900">{selectedEvent.organizerName}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-brand-200 pt-2">
                                    <span className="text-xs font-bold text-brand-500 tracking-widest opacity-80">参加予定人数</span>
                                    <span className="text-sm font-bold text-brand-900">{selectedEvent.participantCount || 0} 人</span>
                                </div>
                            </div>
                            
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-brand-800 mb-2 tracking-widest border-l-2 border-[#b8860b] pl-2 font-serif">イベント詳細</h3>
                                <p className="text-brand-700 text-sm whitespace-pre-wrap leading-relaxed">{selectedEvent.description}</p>
                            </div>
                            
                            {selectedEvent.tags?.length > 0 && (
                                <div className="mb-6 flex flex-wrap gap-2">
                                    {selectedEvent.tags.map(t => <span key={t} className="text-xs bg-white text-brand-600 border border-brand-200 px-2 py-1 rounded-sm shadow-sm font-bold tracking-widest">#{t}</span>)}
                                </div>
                            )}

                            <div className="mt-6 flex flex-col gap-3">
                                {selectedEvent.organizerId !== user?.uid && (
                                    <button onClick={() => toggleParticipate(selectedEvent)} className={`w-full py-3.5 rounded-sm text-sm font-bold tracking-widest transition-colors shadow-md border ${selectedEvent.participants?.includes(user?.uid || '') ? 'bg-[#fffdf9] text-brand-700 border-brand-300 hover:bg-brand-50 text-center' : 'bg-[#3e2723] text-[#d4af37] hover:bg-[#2a1a17] border-[#b8860b] text-center'}`}>
                                        {selectedEvent.participants?.includes(user?.uid || '') ? '参加をキャンセル' : '参加を申し込む'}
                                    </button>
                                )}
                                {(userData?.userId === 'admin' || userData?.uid === selectedEvent.organizerId) && (
                                    <button onClick={() => { setSelectedEvent(null); openEventModal(selectedEvent.id); }} className="w-full py-2.5 bg-[#f7f5f0] border border-brand-300 text-brand-700 rounded-sm text-xs font-bold tracking-widest hover:bg-white transition-colors shadow-sm">編集画面を開く</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Job Detail Sheet (placeholder) */}
            <div className={`detail-sheet fixed bottom-0 left-0 w-full z-[80] bg-[#fffdf9] border-t border-brand-300 rounded-t-xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-safe-bottom max-h-[90vh] overflow-y-auto lg:top-16 lg:bottom-auto lg:left-auto lg:right-0 lg:w-[450px] lg:h-[calc(100vh-64px)] lg:max-h-none lg:rounded-none lg:border-t-0 lg:border-l lg:pb-0 bg-texture transition-transform duration-300 ${selectedJob && !adjustMode ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full'}`}>
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
                                    <span className="text-sm font-bold text-brand-900">{selectedJob.organizerName}</span>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-brand-800 mb-2 tracking-widest border-l-2 border-blue-500 pl-2 font-serif">業務詳細</h3>
                                <p className="text-brand-700 text-sm whitespace-pre-wrap leading-relaxed">{selectedJob.desc}</p>
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
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Event Modal */}
            {eventModalOpen && (
                <div className="fixed inset-0 z-[120] bg-[#2a1a17]/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
                    <div className="bg-[#fffdf9] bg-texture w-full sm:w-[600px] h-[95vh] sm:h-[90vh] rounded-t-sm sm:rounded-sm shadow-2xl flex flex-col border border-brand-300">
                        <div className="p-4 border-b border-brand-200 flex justify-between items-center flex-shrink-0 bg-[#fffdf9]">
                            <h3 className="font-bold text-lg text-brand-900 font-serif tracking-widest">{editingEventId ? 'イベントを編集' : 'イベントを企画'}</h3>
                            <button onClick={() => setEventModalOpen(false)} className="p-2 text-brand-400 hover:text-brand-700"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-2 tracking-widest">イベント名 <span className="text-red-500">*</span></label>
                                <input type="text" value={eventFormData.title} onChange={e=>setEventFormData({...eventFormData, title: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-3 bg-white" placeholder="例: 週末朝活コーヒー会" required />
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
                                    <button onClick={() => { setEventModalOpen(false); setAdjustMode('event'); }} type="button" className="w-full py-2 bg-white border border-brand-300 text-brand-700 rounded-sm text-xs font-bold hover:bg-brand-100 transition-colors flex items-center justify-center gap-2 tracking-widest shadow-sm mb-3">
                                        <MapPin className="w-4 h-4 text-brand-500"/> 地図で位置を設定する
                                    </button>
                                    {adjustCoords && <p className="text-[10px] text-brand-500 mb-3 text-center">緯度: {adjustCoords.lat.toFixed(4)}, 経度: {adjustCoords.lng.toFixed(4)}</p>}
                                    <input type="text" value={eventFormData.locationName} onChange={e=>setEventFormData({...eventFormData, locationName: e.target.value})} placeholder="表示する場所名 (例: ミッドランドスクエア)" className="w-full border border-brand-200 rounded-sm text-sm p-2.5 bg-white" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-1 tracking-widest">詳細内容</label>
                                <textarea value={eventFormData.desc} onChange={e=>setEventFormData({...eventFormData, desc: e.target.value})} rows={5} className="w-full border border-brand-200 rounded-sm text-sm p-3 bg-white leading-relaxed" placeholder="イベント詳細"></textarea>
                            </div>
                        </div>
                        <div className="p-4 border-t border-brand-200 bg-[#f7f5f0] pb-safe-bottom sm:pb-4 flex-shrink-0">
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
                    <div className="bg-[#fffdf9] bg-texture w-full sm:w-[650px] h-[95vh] sm:h-[90vh] rounded-t-sm sm:rounded-sm shadow-2xl flex flex-col border border-brand-300">
                        <div className="p-4 border-b border-brand-200 flex justify-between items-center flex-shrink-0 bg-[#fffdf9]">
                            <h3 className="font-bold text-lg text-brand-900 font-serif tracking-widest">{editingJobId ? '仕事・依頼を編集' : '仕事・依頼を掲載'}</h3>
                            <button onClick={() => setJobModalOpen(false)} className="p-2 text-brand-400 hover:text-brand-700"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-1 tracking-widest">募集タイトル</label>
                                <input type="text" value={jobFormData.title} onChange={e=>setJobFormData({...jobFormData, title: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder="例: 新規事業のUI/UXデザイナー募集" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-1 tracking-widest">業務詳細</label>
                                <textarea value={jobFormData.desc} onChange={e=>setJobFormData({...jobFormData, desc: e.target.value})} rows={6} className="w-full border border-brand-200 rounded-sm text-sm p-3 bg-white leading-relaxed" required></textarea>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-brand-700 mb-1">報酬形態</label>
                                    <select value={jobFormData.rewardType} onChange={e=>setJobFormData({...jobFormData, rewardType: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white">
                                        <option value="固定報酬">固定報酬</option>
                                        <option value="時給">時給</option>
                                        <option value="成果報酬">成果報酬</option>
                                        <option value="応相談">応相談</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-brand-700 mb-1">金額・レンジ</label>
                                    <input type="text" value={jobFormData.rewardAmount} onChange={e=>setJobFormData({...jobFormData, rewardAmount: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder="例: 10万円〜" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-700 mb-1">勤務形態</label>
                                <select value={jobFormData.workStyle} onChange={e=>setJobFormData({...jobFormData, workStyle: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white">
                                    <option value="フルリモート">フルリモート</option>
                                    <option value="一部出社">一部出社</option>
                                    <option value="出社必須">出社必須</option>
                                </select>
                            </div>
                            {jobFormData.workStyle !== 'フルリモート' && (
                                <div className="p-3 border border-brand-200 rounded-sm bg-brand-50 mt-2">
                                    <button onClick={() => { setJobModalOpen(false); setAdjustMode('job'); }} type="button" className="w-full py-2 bg-white border border-brand-300 text-brand-700 rounded-sm text-xs font-bold hover:bg-brand-100 transition-colors flex items-center justify-center gap-1 mb-2 shadow-sm tracking-widest">
                                        <MapPin className="w-4 h-4 text-brand-500" /> 地図で微調整する
                                    </button>
                                    {adjustCoords && <p className="text-[10px] text-brand-500 mb-3 text-center">緯度: {adjustCoords.lat.toFixed(4)}, 経度: {adjustCoords.lng.toFixed(4)}</p>}
                                    <input type="text" value={jobFormData.locationName} onChange={e=>setJobFormData({...jobFormData, locationName: e.target.value})} className="w-full border border-brand-200 rounded-sm text-sm p-2 bg-white" placeholder="表示名 (例: 渋谷)" />
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-brand-200 bg-[#f7f5f0] pb-safe-bottom sm:pb-4 flex-shrink-0">
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
                <Navbar />
                <div className="flex-1 flex items-center justify-center pt-20">
                    <Compass className="w-10 h-10 animate-spin text-brand-400 opacity-70" />
                </div>
            </div>
        }>
            <EventsContent />
        </Suspense>
    );
}

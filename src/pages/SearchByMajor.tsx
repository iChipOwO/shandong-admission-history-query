import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { admissionRepository } from '../services/admissionRepository';
import { type GroupedAdmission } from '../utils/admissionGrouping';
import type { UserProfile } from '../types/user';
import { useAdmissionData } from '../context/AdmissionDataContext';
import { useSchoolMetadata } from '../hooks/useSchoolMetadata';
import { useMajorDirection } from '../context/MajorDirectionContext';
import { SCHOOL_FILTER_TAGS } from '../data/schoolMetadata';
import type { AdmissionSearchFilters } from '../types/search';
import type { FavoriteItem } from '../types/favorite';
import type { AdmissionReport } from '../types/report';
import AdmissionResultCard from '../components/AdmissionResultCard';
import SchoolPickerModal from '../components/SchoolPickerModal';
import CityPickerModal from '../components/CityPickerModal';
import MajorDirectionPickerModal from '../components/MajorDirectionPickerModal';
import { getDefaultRankRange } from '../utils/rankHelper';
import DisclaimerBar from '../components/DisclaimerBar';

const PAGE_SIZE = 50;
const REPORTS_KEY = 'gaokao_reports';
const ACTIVE_REPORT_KEY = 'gaokao_active_report_id';
const FILTER_STATE_KEY = 'gaokao_query_filter_state';
const CITY_KEY_SEPARATOR = '::';

// ─── Persisted filter state ────────────────────────────────────────────────

interface PersistedFilterState {
  selectedSchoolCodes: string[];
  selectedCities: string[];
  majorKeyword: string;
  selectedMajorGroups: string[];        // 旧字段，保留以不崩溃，忽略筛选
  selectedMajorDirectionIds: string[];  // 新字段
  showUncertainMajorDirections: boolean;
  onlyShow2025Available?: boolean;
  selectedSchoolTags: string[];
  rankMin: number | null;
  rankMax: number | null;
  showAll: boolean;
  showCityUnconfirmed: boolean;
  lastProfileRankForRange?: number;
}

function loadFilterState(): PersistedFilterState | null {
  try {
    const raw = localStorage.getItem(FILTER_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveFilterState(state: PersistedFilterState) {
  try {
    localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function getCityKey(province?: string, city?: string): string | null {
  if (!province || !city) return null;
  return `${province}${CITY_KEY_SEPARATOR}${city}`;
}

function formatCityKeyLabel(key: string): string {
  return key.includes(CITY_KEY_SEPARATOR) ? key.replace(CITY_KEY_SEPARATOR, ' · ') : key;
}

function normalizePersistedCityKeys(values: string[], metadataList: Array<{ province?: string; city?: string }>): string[] {
  const cityToKeys = new Map<string, string[]>();
  metadataList.forEach(item => {
    const key = getCityKey(item.province, item.city);
    if (!key || !item.city) return;
    const keys = cityToKeys.get(item.city) || [];
    if (!keys.includes(key)) keys.push(key);
    cityToKeys.set(item.city, keys);
  });

  return Array.from(new Set(values.map(value => {
    if (value.includes(CITY_KEY_SEPARATOR)) return value;
    const keys = cityToKeys.get(value);
    return keys?.length === 1 ? keys[0] : value;
  })));
}

function hasValid2025AdmissionRecord(group: GroupedAdmission): boolean {
  const minRank: unknown = group.records[2025]?.minRank;
  if (typeof minRank === 'number') {
    return Number.isFinite(minRank) && minRank > 0;
  }
  if (typeof minRank === 'string') {
    const trimmed = minRank.trim();
    return trimmed !== '' && trimmed !== '--' && Number.isFinite(Number(trimmed)) && Number(trimmed) > 0;
  }
  return false;
}

// ─── AdmissionTips inline modal content ───────────────────────────────────

const TipsModalContent: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 2000,
    }}
    onClick={onClose}
  >
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        background: 'white', borderRadius: '16px 16px 0 0',
        padding: '20px',
        width: 'min(720px, calc(100vw - 24px))',
        maxWidth: 'calc(100vw - 24px)',
        margin: '0 auto',
        maxHeight: '80vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        boxSizing: 'border-box',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600 }}>📖 填报常识</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#9ca3af', cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>🎯 为什么位次比分数重要？</strong>
          <p>高考每年难度不同，同分数的实际含金量会变化，但全省考生的位次相对稳定。填报志愿以位次为主，分数仅作辅助参考。位次数字越小，录取门槛越高。</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>📋 山东"专业+学校"模式</strong>
          <p>山东实行新高考，志愿填报单位是"一个专业（或专业类）+ 一所学校"。可以直接填报具体专业，无需专业调剂，录取即录入该专业，退档风险较低。</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>🏫 大类招生及试验班</strong>
          <p>大类招生通常在大一或大二后进行专业分流。大类分流通常会参考大学期间课程成绩、专业志愿、培养方案要求等，具体以学校分流规则为准。</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>🌏 中外合作、异地校区与高收费</strong>
          <p>中外合作：学费较高，部分专业有出国要求。异地校区：师资和保研率可能与本部有差异。高收费专业：请确认家庭可承受范围。</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>📝 2026专业变更核查提示</strong>
          <p>2026年可能会有新增专业、专业改名、专业合并、招生计划大幅变化、选科要求变化等情况，使用时请务必核对当年的最新官方招生章程。</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>📉 关于“数据不全”</strong>
          <p>“数据不全”指的是软件中没有查到相关公开数据，可能是因为学校在该年份并未在山东省该批次进行招生，或者没有公开投档最低位次等情况。</p>
        </div>
      </div>
      <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: '16px', width: '100%' }}>关闭</button>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const SearchByMajor: React.FC = () => {
  const navigate = useNavigate();
  const { status: admissionStatus, retry } = useAdmissionData();
  const { getSchoolMetadata, metadataList, status: metaStatus } = useSchoolMetadata();
  const { status: dirStatus, groups: dirGroups, index: dirIndex } = useMajorDirection();

  // ── 精确筛选器状态
  const [selectedSchoolCodes, setSelectedSchoolCodes] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showDirectionPicker, setShowDirectionPicker] = useState(false);

  // ── 专业方向筛选状态
  const [selectedMajorDirectionIds, setSelectedMajorDirectionIds] = useState<string[]>([]);
  const [showUncertainMajorDirections, setShowUncertainMajorDirections] = useState(false);

  // ── 其他筛选状态
  const [majorKw, setMajorKw] = useState('');
  const [onlyShow2025Available, setOnlyShow2025Available] = useState(false);
  const [filters, setFilters] = useState<AdmissionSearchFilters>({
    majorKeyword: '',
    selectedMajorGroups: [],   // 旧字段，不参与新逻辑
    rankMin: null,
    rankMax: null,
    rankExpandPercent: 10,
    showCityUnconfirmed: true,
  });

  // ── UI 状态
  const [results, setResults] = useState<GroupedAdmission[]>([]);
  const [totalMatched, setTotalMatched] = useState(0);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [reports, setReports] = useState<AdmissionReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [showTipsModal, setShowTipsModal] = useState(false);

  // ── 滚动引用
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    const timerId = window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 0);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
    };
  }, []);

  // ── 恢复已持久化的筛选状态
  useEffect(() => {
    // User profile
    const saved = localStorage.getItem('gaokao_user_profile');
    if (saved) {
      try {
        const p = JSON.parse(saved) as UserProfile;
        setProfile(p);
        // Restore filter state first, then fallback to profile rank
        const savedFilter = loadFilterState();
        if (savedFilter) {
          setSelectedSchoolCodes(savedFilter.selectedSchoolCodes || []);
          setSelectedCities(savedFilter.selectedCities || []);
          setMajorKw(savedFilter.majorKeyword || '');
          setShowAll(savedFilter.showAll || false);
          setSelectedMajorDirectionIds(savedFilter.selectedMajorDirectionIds || []);
          setShowUncertainMajorDirections(savedFilter.showUncertainMajorDirections || false);
          setOnlyShow2025Available(savedFilter.onlyShow2025Available === true);
          const userRankChanged = p.rank && savedFilter.lastProfileRankForRange !== p.rank;
          
          setFilters(prev => {
            const defaultRange = p.rank ? getDefaultRankRange(p.rank) : null;
            return {
              ...prev,
              selectedSchoolTags: savedFilter.selectedSchoolTags || [],
              rankMin: userRankChanged ? (defaultRange?.rankMin ?? null) : (savedFilter.rankMin ?? (defaultRange?.rankMin ?? null)),
              rankMax: userRankChanged ? (defaultRange?.rankMax ?? null) : (savedFilter.rankMax ?? (defaultRange?.rankMax ?? null)),
              showCityUnconfirmed: savedFilter.showCityUnconfirmed ?? true,
            };
          });
        } else if (p.rank && p.rank > 0) {
          const r = p.rank;
          const { rankMin, rankMax } = getDefaultRankRange(r);
          setFilters(prev => ({
            ...prev,
            rankMin,
            rankMax,
          }));
        }
      } catch {}
    } else {
      // No profile: try restore filter state
      const savedFilter = loadFilterState();
      if (savedFilter) {
        setSelectedSchoolCodes(savedFilter.selectedSchoolCodes || []);
        setSelectedCities(savedFilter.selectedCities || []);
        setMajorKw(savedFilter.majorKeyword || '');
        setShowAll(savedFilter.showAll || false);
        setSelectedMajorDirectionIds(savedFilter.selectedMajorDirectionIds || []);
        setShowUncertainMajorDirections(savedFilter.showUncertainMajorDirections || false);
        setOnlyShow2025Available(savedFilter.onlyShow2025Available === true);
        setFilters(prev => ({
          ...prev,
          selectedSchoolTags: savedFilter.selectedSchoolTags || [],
          rankMin: savedFilter.rankMin ?? null,
          rankMax: savedFilter.rankMax ?? null,
          showCityUnconfirmed: savedFilter.showCityUnconfirmed ?? true,
        }));
      }
    }

    const savedFavs = localStorage.getItem('gaokao_favorites');
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch {}
    }
    loadReports();
  }, []);

  // ── 持久化筛选状态
  const persistFilterState = useCallback(() => {
    saveFilterState({
      selectedSchoolCodes,
      selectedCities,
      majorKeyword: majorKw,
      selectedMajorGroups: [],   // 旧字段置空，不再写入旧 group
      selectedMajorDirectionIds,
      showUncertainMajorDirections,
      onlyShow2025Available,
      selectedSchoolTags: filters.selectedSchoolTags || [],
      rankMin: filters.rankMin ?? null,
      rankMax: filters.rankMax ?? null,
      showAll,
      showCityUnconfirmed: filters.showCityUnconfirmed ?? true,
      lastProfileRankForRange: profile?.rank ?? undefined,
    });
  }, [selectedSchoolCodes, selectedCities, majorKw, selectedMajorDirectionIds, showUncertainMajorDirections, onlyShow2025Available, filters, showAll, profile]);

  useEffect(() => {
    persistFilterState();
  }, [persistFilterState]);

  useEffect(() => {
    if (metaStatus !== 'ready' || selectedCities.length === 0) return;
    const normalized = normalizePersistedCityKeys(selectedCities, metadataList);
    if (normalized.length !== selectedCities.length || normalized.some((value, index) => value !== selectedCities[index])) {
      setSelectedCities(normalized);
    }
  }, [metaStatus, metadataList, selectedCities]);

  const loadReports = () => {
    const raw = localStorage.getItem(REPORTS_KEY);
    let reps: AdmissionReport[] = [];
    if (raw) {
      try { reps = JSON.parse(raw); } catch {}
    }
    if (reps.length === 0) {
      const mainReport: AdmissionReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'main',
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      reps = [mainReport];
      localStorage.setItem(REPORTS_KEY, JSON.stringify(reps));
    }
    setReports(reps);
    const savedActiveId = localStorage.getItem(ACTIVE_REPORT_KEY);
    const validActive = savedActiveId && reps.find(r => r.id === savedActiveId);
    if (validActive) {
      setActiveReportId(validActive.id);
    } else {
      const mainRep = reps.find(r => r.name === 'main') || reps[0];
      setActiveReportId(mainRep.id);
      localStorage.setItem(ACTIVE_REPORT_KEY, mainRep.id);
    }
  };

  const handleReportChange = (newId: string) => {
    setActiveReportId(newId);
    localStorage.setItem(ACTIVE_REPORT_KEY, newId);
  };

  const handleCreateReport = () => {
    const name = prompt('请输入新报告名称：');
    if (!name || !name.trim()) return;
    const raw = localStorage.getItem(REPORTS_KEY);
    let reps: AdmissionReport[] = raw ? JSON.parse(raw) : [];
    const newRep: AdmissionReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reps = [...reps, newRep];
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reps));
    setReports(reps);
    handleReportChange(newRep.id);
  };

  const handleSearch = async () => {
    if (admissionStatus !== 'ready') return;
    setLoading(true);
    setSearched(true);
    setTimeout(async () => {
      try {
        const mergedFilters: AdmissionSearchFilters = {
          ...filters,
          schoolKeyword: '',       // 旧字段清空，使用精确选择器
          keyword: '',
          cityKeywords: [],        // 旧字段清空，使用精确选择器
          majorKeyword: majorKw,
          selectedSchoolCodes,     // 精确学校筛选
          selectedCities,          // 精确城市筛选
          rankMin: showAll ? null : (filters.rankMin ?? null),
          rankMax: showAll ? null : (filters.rankMax ?? null),
          rankExpandPercent: 0,
          selectedMajorDirectionIds,
          showUncertainMajorDirections,
        };
        // 传入 majorDirectionIndex 给 repository
        const indexToPass = dirStatus === 'ready' ? dirIndex : undefined;
        const res = await admissionRepository.searchRecords(mergedFilters, getSchoolMetadata, indexToPass);
        const filteredGroups = onlyShow2025Available
          ? res.groups.filter(hasValid2025AdmissionRecord)
          : res.groups;
        setResults(filteredGroups);
        setTotalMatched(filteredGroups.length);
        setDisplayCount(PAGE_SIZE);
        
        // 自动滚动到结果区域，加一点延迟确保渲染完成
        setTimeout(() => {
          if (resultsContainerRef.current) {
            resultsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 10);
  };

  const handleToggleFav = (group: GroupedAdmission) => {
    const id = `${group.schoolCode}_${group.majorCode}`;
    const exists = favorites.find(f => f.id === id);
    let newFavs;
    if (exists) {
      newFavs = favorites.filter(f => f.id !== id);
    } else {
      newFavs = [...favorites, {
        id,
        type: 'choice',
        schoolCode: group.schoolCode,
        schoolName: group.schoolName,
        majorCode: group.majorCode,
        majorName: group.majorName,
        createdAt: new Date().toISOString()
      } as FavoriteItem];
    }
    setFavorites(newFavs);
    localStorage.setItem('gaokao_favorites', JSON.stringify(newFavs));
  };

  // 查找已选学校名（用于 chip 显示）
  const selectedSchoolNames = selectedSchoolCodes.map(code => {
    const meta = metadataList.find(s => s.schoolCode === code);
    return meta ? meta.schoolName : code;
  });

  const selectedCityLabels = useMemo(() => {
    const knownKeys = new Set(
      metadataList
        .map(item => getCityKey(item.province, item.city))
        .filter(Boolean) as string[]
    );

    return selectedCities.map(key => {
      if (knownKeys.has(key)) return formatCityKeyLabel(key);
      return formatCityKeyLabel(key);
    });
  }, [metadataList, selectedCities]);

  // 已选方向名称（用于 chip 显示）
  const selectedDirectionNames = useMemo(() => {
    return selectedMajorDirectionIds.map(id => {
      const g = dirGroups.find(g => g.id === id);
      return g ? g.name : id;
    });
  }, [selectedMajorDirectionIds, dirGroups]);

  const activeReport = reports.find(r => r.id === activeReportId);

  const dirIsLoading = dirStatus === 'idle' || dirStatus === 'loading';
  const dirIsError = dirStatus === 'error';

  if (admissionStatus === 'error') {
    return (
      <div>
        <header className="header">
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
          <h1>模拟志愿查询</h1>
        </header>
        <div className="page-container">
          <div className="card">
            <p style={{ color: '#b91c1c', marginBottom: '12px', fontSize: '14px' }}>⚠️ 录取库初始化失败，请重试。</p>
            <button className="btn" onClick={retry}>重试</button>
          </div>
        </div>
      </div>
    );
  }

  const metaIsLoading = metaStatus === 'idle' || metaStatus === 'loading';
  const metaIsError = metaStatus === 'error';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '17px' }}>模拟志愿查询</h1>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
            山东 2023–2025 普通类常规批第1次志愿
          </div>
        </div>
        <button
          onClick={() => setShowTipsModal(true)}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', padding: '4px 10px', cursor: 'pointer' }}
        >
          📖 填报常识
        </button>
      </header>

      <div className="page-container" style={{ flex: 1 }}>

        {/* 数据初始化提示 */}
        {admissionStatus !== 'ready' && (
          <div className="notice-bar notice-bar--warning">
            📥 本地录取库正在初始化，首次加载需要几秒。加载完成后可离线查询。
          </div>
        )}

        {/* ─── 当前报告选择 ─────────────────────────── */}
        <div className="card" style={{ marginBottom: '12px', padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flexShrink: 0 }}>加入报告：</span>
            <select
              className="form-control"
              style={{ flex: 1, minWidth: '120px', fontSize: '13px', height: '34px', padding: '0 8px' }}
              value={activeReportId || ''}
              onChange={e => handleReportChange(e.target.value)}
            >
              {reports.map(r => (
                <option key={r.id} value={r.id}>{r.name}（{r.items.length}项）</option>
              ))}
            </select>
            <button
              onClick={handleCreateReport}
              style={{
                flexShrink: 0, fontSize: '12px', padding: '4px 10px',
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: '6px', color: '#1e40af', cursor: 'pointer',
              }}
            >
              + 新建报告
            </button>
            <button
              onClick={() => navigate('/reports')}
              style={{
                flexShrink: 0, fontSize: '12px', padding: '4px 10px',
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              管理报告 →
            </button>
          </div>
          {activeReport && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              当前报告已有 {activeReport.items.length} 个候选项
            </div>
          )}
        </div>

        {/* ─── 筛选区域 ─────────────────────────── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '-4px' }}>
            查询筛选
          </div>

          {/* 元数据加载提示 */}
          {metaIsLoading && (
            <div style={{ fontSize: '12px', color: '#6b7280', padding: '4px 0' }}>
              ⏳ 学校与城市选择器正在初始化，请稍候。
            </div>
          )}
          {metaIsError && (
            <div style={{ fontSize: '12px', color: '#b91c1c', padding: '4px 0' }}>
              ⚠️ 学校与城市选择器暂不可用，但可继续使用专业和位次筛选。
            </div>
          )}

          {/* 专业方向数据加载提示 */}
          {dirIsLoading && (
            <div style={{ fontSize: '12px', color: '#6b7280', padding: '4px 0' }}>
              ⏳ 专业方向数据正在初始化…
            </div>
          )}
          {dirIsError && (
            <div style={{ fontSize: '12px', color: '#b45309', padding: '4px 0' }}>
              ⚠️ 专业方向选择器暂不可用，专业名称搜索仍可正常使用。
            </div>
          )}

          {/* ── 学校筛选 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '4px', height: '14px', background: '#3b82f6', borderRadius: '2px', marginRight: '6px' }}></span>
                学校筛选
                <span style={{ color: selectedSchoolCodes.length > 0 ? 'var(--primary-color)' : '#9ca3af', marginLeft: '6px', fontSize: '13px', fontWeight: 400 }}>
                  {selectedSchoolCodes.length > 0 ? `已选 ${selectedSchoolCodes.length} 所` : '全部学校'}
                </span>
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {selectedSchoolCodes.length > 0 && (
                  <button
                    onClick={() => setSelectedSchoolCodes([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
                  >
                    清空
                  </button>
                )}
                <button
                  onClick={() => setShowSchoolPicker(true)}
                  disabled={metaIsLoading || metaIsError}
                  style={{
                    fontSize: '12px', padding: '4px 10px',
                    background: metaIsLoading || metaIsError ? '#f3f4f6' : '#eff6ff',
                    border: '1px solid',
                    borderColor: metaIsLoading || metaIsError ? '#e5e7eb' : '#bfdbfe',
                    borderRadius: '6px',
                    color: metaIsLoading || metaIsError ? '#9ca3af' : '#1e40af',
                    cursor: metaIsLoading || metaIsError ? 'not-allowed' : 'pointer',
                  }}
                >
                  {metaIsLoading ? '加载中…' : '选择学校'}
                </button>
              </div>
            </div>
            {/* 已选学校 chips */}
            {selectedSchoolCodes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {selectedSchoolNames.map((name, i) => (
                  <span
                    key={selectedSchoolCodes[i]}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      borderRadius: '12px', padding: '2px 8px',
                      fontSize: '12px', color: '#1e40af', maxWidth: '100%',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                      {name}
                    </span>
                    <button
                      onClick={() => setSelectedSchoolCodes(prev => prev.filter(c => c !== selectedSchoolCodes[i]))}
                      style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 1px' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── 城市筛选 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '4px', height: '14px', background: '#3b82f6', borderRadius: '2px', marginRight: '6px' }}></span>
                城市筛选
                <span style={{ color: selectedCities.length > 0 ? 'var(--primary-color)' : '#9ca3af', marginLeft: '6px', fontSize: '13px', fontWeight: 400 }}>
                  {selectedCities.length > 0 ? `已选 ${selectedCities.length} 个` : '全部城市'}
                </span>
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {selectedCities.length > 0 && (
                  <button
                    onClick={() => setSelectedCities([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
                  >
                    清空
                  </button>
                )}
                <button
                  onClick={() => setShowCityPicker(true)}
                  disabled={metaIsLoading || metaIsError}
                  style={{
                    fontSize: '12px', padding: '4px 10px',
                    background: metaIsLoading || metaIsError ? '#f3f4f6' : '#eff6ff',
                    border: '1px solid',
                    borderColor: metaIsLoading || metaIsError ? '#e5e7eb' : '#bfdbfe',
                    borderRadius: '6px',
                    color: metaIsLoading || metaIsError ? '#9ca3af' : '#1e40af',
                    cursor: metaIsLoading || metaIsError ? 'not-allowed' : 'pointer',
                  }}
                >
                  {metaIsLoading ? '加载中…' : '选择城市'}
                </button>
              </div>
            </div>
            {/* 已选城市 chips */}
            {selectedCities.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {selectedCityLabels.map((cityLabel, i) => (
                  <span
                    key={selectedCities[i]}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      borderRadius: '12px', padding: '2px 8px',
                      fontSize: '12px', color: '#1e40af', maxWidth: '100%',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                      {cityLabel}
                    </span>
                    <button
                      onClick={() => setSelectedCities(prev => prev.filter(c => c !== selectedCities[i]))}
                      style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 1px' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── 专业方向筛选（新） */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '4px', height: '14px', background: '#3b82f6', borderRadius: '2px', marginRight: '6px' }}></span>
                专业方向筛选
                <span style={{
                  color: selectedMajorDirectionIds.length > 0 ? 'var(--primary-color)' : '#9ca3af',
                  marginLeft: '6px', fontSize: '13px', fontWeight: 400
                }}>
                  {selectedMajorDirectionIds.length > 0 ? `已选 ${selectedMajorDirectionIds.length} 个` : '全部方向'}
                </span>
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {selectedMajorDirectionIds.length > 0 && (
                  <button
                    onClick={() => setSelectedMajorDirectionIds([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
                  >
                    清空
                  </button>
                )}
                <button
                  onClick={() => setShowDirectionPicker(true)}
                  disabled={dirIsLoading || dirIsError}
                  style={{
                    fontSize: '12px', padding: '4px 10px',
                    background: dirIsLoading || dirIsError ? '#f3f4f6' : '#eff6ff',
                    border: '1px solid',
                    borderColor: dirIsLoading || dirIsError ? '#e5e7eb' : '#bfdbfe',
                    borderRadius: '6px',
                    color: dirIsLoading || dirIsError ? '#9ca3af' : '#1e40af',
                    cursor: dirIsLoading || dirIsError ? 'not-allowed' : 'pointer',
                  }}
                >
                  {dirIsLoading ? '初始化中…' : '选择专业方向'}
                </button>
              </div>
            </div>

            {/* 已选方向 chips */}
            {selectedDirectionNames.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                {selectedDirectionNames.map((name, i) => (
                  <span
                    key={selectedMajorDirectionIds[i]}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      borderRadius: '12px', padding: '2px 8px',
                      fontSize: '12px', color: '#1e40af',
                    }}
                  >
                    {name}
                    <button
                      onClick={() => setSelectedMajorDirectionIds(prev => prev.filter(id => id !== selectedMajorDirectionIds[i]))}
                      style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 1px' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* 显示未明确归属开关 */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              fontSize: '12px', color: 'var(--text-secondary)',
              lineHeight: 1.5, cursor: 'pointer', padding: '4px 0',
            }}>
              <input
                type="checkbox"
                checked={showUncertainMajorDirections}
                onChange={e => setShowUncertainMajorDirections(e.target.checked)}
                style={{ marginTop: '2px', flexShrink: 0 }}
              />
              <span>
                显示未明确归属的大类/试验班
                <span style={{
                  display: 'block', fontSize: '11px', color: '#9ca3af',
                  marginTop: '2px', lineHeight: 1.4,
                }}>
                  开启后会额外显示方向无法稳定确认的大类、试验班和重点院校特殊项目，并在结果中提示核对招生章程。
                </span>
              </span>
            </label>

            {/* 专业方向说明小字 */}
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>
              专业方向基于已内置的投档专业名称和专业方向分类数据进行辅助筛选；大类招生、试验班和方向不明确项目会标记为需核对，具体以学校招生章程为准。
            </div>
          </div>

          {/* ── 专业名称搜索 */}
          <div>
            <label style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ width: '4px', height: '14px', background: '#3b82f6', borderRadius: '2px', marginRight: '6px' }}></span>
              专业名称搜索
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="例如：计算机"
              value={majorKw}
              onChange={e => setMajorKw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* ── 位次范围 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '4px', height: '14px', background: '#3b82f6', borderRadius: '2px', marginRight: '6px' }}></span>
                最低位次范围
                {profile?.rank && (
                  <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '8px' }}>
                    （我的位次：{profile.rank.toLocaleString()}）
                    <button onClick={() => {
                      const { rankMin, rankMax } = getDefaultRankRange(profile.rank!);
                      setFilters({ ...filters, rankMin, rankMax });
                    }} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary-color)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', marginLeft: '6px' }}>按我的位次重置范围</button>
                  </span>
                )}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={e => setShowAll(e.target.checked)}
                  style={{ margin: 0 }}
                />
                展示所有结果
              </label>
            </div>
            {!showAll ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  className="form-control"
                  placeholder="位次起（如 1941）"
                  value={filters.rankMin || ''}
                  onChange={e => setFilters({ ...filters, rankMin: e.target.value ? parseInt(e.target.value) : null })}
                />
                <input
                  type="number"
                  className="form-control"
                  placeholder="位次止（如 3654）"
                  value={filters.rankMax || ''}
                  onChange={e => setFilters({ ...filters, rankMax: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#9ca3af', padding: '6px 0' }}>
                已展示所有数据，不限位次范围。
              </div>
            )}
            {!profile?.rank && !showAll && (
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                未填写位次，建议先
                <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary-color)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', marginLeft: '2px' }}>
                  填写我的信息
                </button>
                ，或手动填写位次区间。
              </div>
            )}
          </div>

          {/* ── 高级筛选 */}
          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              高级筛选
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, cursor: 'pointer', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  checked={onlyShow2025Available}
                  onChange={e => setOnlyShow2025Available(e.target.checked)}
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <span>
                  仅展示25年可以报名的专业
                  <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginTop: '2px', lineHeight: 1.4 }}>
                    开启后，将隐藏 2025 年没有录取记录的专业。2025 年数据缺失通常说明该专业可能已更名、停招、未在当前批次招生或招生口径发生变化。
                  </span>
                </span>
              </label>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>学校标签（多选则取交集）</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {SCHOOL_FILTER_TAGS.map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setFilters(prev => {
                        const current = prev.selectedSchoolTags || [];
                        return {
                          ...prev,
                          selectedSchoolTags: current.includes(t) ? current.filter(x => x !== t) : [...current, t]
                        };
                      });
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      border: '1px solid var(--border-color)',
                      background: filters.selectedSchoolTags?.includes(t) ? 'var(--primary-color)' : 'white',
                      color: filters.selectedSchoolTags?.includes(t) ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      minHeight: '28px',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filters.showCityUnconfirmed !== false}
                    onChange={e => setFilters({ ...filters, showCityUnconfirmed: e.target.checked })}
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  />
                  展示城市位置待确认的学校（如山东大学、哈尔滨工业大学等跨校区高校）
                </label>
              </div>
            </div>
          </div>

          <button
            className="btn"
            onClick={handleSearch}
            disabled={admissionStatus !== 'ready' || loading}
          >
            {loading
              ? '正在查找，数据量较大请稍候……'
              : admissionStatus !== 'ready'
              ? '等待数据初始化……'
              : '查询'}
          </button>
        </div>

        {/* 数据范围说明 */}
        <div className="notice-bar notice-bar--info" style={{ fontSize: '12px' }}>
          ℹ️ 仅含 2023–2025 山东普通类常规批第1次志愿数据。学校和城市选项来自已内置的学校元数据，用于筛选学校所在城市；留空表示不限制。参考标签为历史位次比较，不预测录取结果。
        </div>

        {/* 未填位次且未展示全部 */}
        {!profile?.rank && !showAll && searched && (
          <div className="notice-bar notice-bar--warning" style={{ fontSize: '12px' }}>
            未填写位次，仅展示历史数据，不做个性化比较。建议填写位次后重新查询。
          </div>
        )}

        {/* 结果提示 */}
        {searched && !loading && (
          <div ref={resultsContainerRef} style={{ scrollMarginTop: '60px' }}>
            {totalMatched > 0 ? (
              <div style={{ marginBottom: '10px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                找到 <strong>{totalMatched}</strong> 条匹配结果，当前展示前 {Math.min(displayCount, totalMatched)} 条。
                {!showAll && profile?.rank && (
                  <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>
                    （位次范围 {filters.rankMin?.toLocaleString()}–{filters.rankMax?.toLocaleString()}）
                  </span>
                )}
                {onlyShow2025Available && (
                  <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>
                    （仅展示25年有记录）
                  </span>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <p style={{ marginBottom: '8px', fontWeight: 500 }}>没有找到符合条件的候选项</p>
                  <p>
                    可以尝试：减少学校或城市限制、放宽位次范围、减少标签筛选，或勾选"展示所有结果"。
                    {onlyShow2025Available && (
                      <>
                        <br />
                        也可尝试关闭“仅展示25年可以报名的专业”筛选。
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="card">
            <div className="loading-state">
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              正在搜索录取库，数据量较大，请稍候……
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {results.slice(0, displayCount).map((group, idx) => {
            const isFav = !!favorites.find(f => f.id === `${group.schoolCode}_${group.majorCode}`);
            return (
              <AdmissionResultCard
                key={idx}
                group={group}
                userRank={profile?.rank}
                isFav={isFav}
                onToggleFav={handleToggleFav}
                activeReportId={activeReportId}
                onReportChange={loadReports}
                majorDirectionIndex={dirStatus === 'ready' ? dirIndex : undefined}
              />
            );
          })}
        </div>

        {displayCount < totalMatched && (
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '16px', marginBottom: '20px' }}
            onClick={() => setDisplayCount(c => c + PAGE_SIZE)}
          >
            展开更多（还有 {totalMatched - displayCount} 条）
          </button>
        )}
      </div>

      {/* 填报常识弹窗 */}
      {showTipsModal && <TipsModalContent onClose={() => setShowTipsModal(false)} />}

      {/* 学校选择器弹窗 */}
      {showSchoolPicker && (
        <SchoolPickerModal
          metadataList={metadataList}
          metadataStatus={metaStatus}
          selectedCodes={selectedSchoolCodes}
          onConfirm={(codes) => {
            setSelectedSchoolCodes(codes);
          }}
          onClose={() => setShowSchoolPicker(false)}
        />
      )}

      {/* 城市选择器弹窗 */}
      {showCityPicker && (
        <CityPickerModal
          metadataList={metadataList}
          metadataStatus={metaStatus}
          selectedCities={selectedCities}
          onConfirm={(cities) => {
            setSelectedCities(cities);
          }}
          onClose={() => setShowCityPicker(false)}
        />
      )}

      {/* 专业方向选择器弹窗 */}
      {showDirectionPicker && !dirIsLoading && !dirIsError && (
        <MajorDirectionPickerModal
          groups={dirGroups}
          selectedIds={selectedMajorDirectionIds}
          onConfirm={(ids) => setSelectedMajorDirectionIds(ids)}
          onClose={() => setShowDirectionPicker(false)}
        />
      )}
      
      <DisclaimerBar />
    </div>
  );
};

export default SearchByMajor;

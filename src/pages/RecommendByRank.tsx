import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '../types/user';
import { useAdmissionData } from '../context/AdmissionDataContext';
import { admissionRepository } from '../services/admissionRepository';
import type { GroupedAdmission } from '../utils/admissionGrouping';
import type { AdmissionSearchFilters } from '../types/search';
import type { FavoriteItem } from '../types/favorite';
import AdmissionResultCard from '../components/AdmissionResultCard';
import { useSchoolMetadata } from '../hooks/useSchoolMetadata';
import { SCHOOL_FILTER_TAGS } from '../data/schoolMetadata';
import { getDefaultRankRange } from '../utils/rankHelper';

const PAGE_SIZE = 50;

const RecommendByRank: React.FC = () => {
  const navigate = useNavigate();
  const { status: admissionStatus } = useAdmissionData();
  const { getSchoolMetadata } = useSchoolMetadata();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  
  const [showAll, setShowAll] = useState(false);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [selectedSchoolTags, setSelectedSchoolTags] = useState<string[]>([]);
  const [showCityUnconfirmed, setShowCityUnconfirmed] = useState(true);

  const [results, setResults] = useState<GroupedAdmission[]>([]);
  const [totalMatched, setTotalMatched] = useState(0);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_user_profile');
    if (saved) {
      try { setProfile(JSON.parse(saved)); } catch (e) {}
    }
    const savedFavs = localStorage.getItem('gaokao_favorites');
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch (e) {}
    }
  }, []);

  const handleSearch = () => {
    if (admissionStatus !== 'ready' || !profile?.rank) return;

    let rankMin: number | null = null;
    let rankMax: number | null = null;

    if (!showAll) {
      if (customRange.start || customRange.end) {
        rankMin = customRange.start ? parseInt(customRange.start) : 1;
        rankMax = customRange.end ? parseInt(customRange.end) : 999999;
      } else {
        const defaultRange = getDefaultRankRange(profile.rank);
        rankMin = defaultRange.rankMin;
        rankMax = defaultRange.rankMax;
      }
    }

    const filters: AdmissionSearchFilters = {
      rankMin,
      rankMax,
      rankExpandPercent: 10,
      selectedSchoolTags,
      showCityUnconfirmed
    };

    setLoading(true);
    setTimeout(async () => {
      try {
        const res = await admissionRepository.searchRecords(filters, getSchoolMetadata);
        setResults(res.groups);
        setTotalMatched(res.totalMatched);
        setDisplayCount(PAGE_SIZE);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 10);
  };

  useEffect(() => {
    if (profile?.rank) {
      handleSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionStatus, profile?.rank, showAll]);

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

  return (
    <div>
      <header className="header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '17px' }}>按位次找候选</h1>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
            山东 2023–2025 普通类常规批第1次志愿
          </div>
        </div>
      </header>
      <div className="page-container">
        
        <div className="notice-bar notice-bar--info" style={{ fontSize: '12px' }}>
          ℹ️ 本页根据历史最低位次区间筛选候选专业，参考标签不是结果预测。需结合当年招生计划复核。
        </div>

        {!profile?.rank ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p style={{ marginBottom: '8px', fontWeight: 500 }}>请先填写全省位次</p>
              <p style={{ marginBottom: '16px' }}>位次是按位次候选的核心依据，分数仅作参考。</p>
            </div>
            <button className="btn" onClick={() => navigate('/profile')}>填写我的成绩信息</button>
          </div>
        ) : (
          <>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px' }}>
                  我的位次：
                  <span style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '18px', marginLeft: '4px' }}>
                    {profile.rank.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => navigate('/profile')}
                  style={{ fontSize: '12px', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  修改
                </button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                💡 位次数字越小，录取门槛越高。
              </div>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={showAll} 
                  onChange={e => setShowAll(e.target.checked)}
                />
                展示所有结果，不按位次自动限制范围
              </label>

              {!showAll && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      起始位次（选填）
                    </label>
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder={`默认: ${getDefaultRankRange(profile.rank).rankMin}`}
                      value={customRange.start}
                      onChange={e => setCustomRange({...customRange, start: e.target.value})}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      结束位次（选填）
                    </label>
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder={`默认: ${getDefaultRankRange(profile.rank).rankMax}`}
                      value={customRange.end}
                      onChange={e => setCustomRange({...customRange, end: e.target.value})}
                    />
                  </div>
                  <button
                    className="btn"
                    style={{ width: 'auto', padding: '10px 16px', fontSize: '14px' }}
                    onClick={handleSearch}
                    disabled={admissionStatus !== 'ready'}
                  >
                    应用
                  </button>
                </div>
              )}

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  学校标签筛选（多选则取交集）
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {SCHOOL_FILTER_TAGS.map(t => (
                    <button 
                      key={t}
                      onClick={() => {
                        setSelectedSchoolTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        border: '1px solid var(--border-color)',
                        background: selectedSchoolTags.includes(t) ? 'var(--primary-color)' : 'white',
                        color: selectedSchoolTags.includes(t) ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        minHeight: '32px',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={showCityUnconfirmed} 
                  onChange={e => setShowCityUnconfirmed(e.target.checked)}
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                展示城市位置待确认的学校（跨校区高校）
              </label>
            </div>

            {/* 结果区域 */}
            {admissionStatus !== 'ready' ? (
              <div className="card">
                <div className="loading-state">
                  📥 本地录取库正在初始化，完成后自动显示候选列表……
                </div>
              </div>
            ) : loading ? (
              <div className="card">
                <div className="loading-state">
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                  正在计算候选列表，请稍候……
                </div>
              </div>
            ) : (
              <>
                {totalMatched > 0 ? (
                  <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    在当前区间找到 <strong>{totalMatched}</strong> 个候选专业，展示前 {Math.min(displayCount, totalMatched)} 条。<br/>
                    <span style={{ fontSize: '12px' }}>排序依据：最新年份最低位次（位次数字越小，录取门槛越高）</span>
                  </div>
                ) : (
                  <div className="card">
                    <div className="empty-state">
                      <div className="empty-state-icon">🔍</div>
                      <p style={{ marginBottom: '8px', fontWeight: 500 }}>当前区间未找到候选专业</p>
                      <p>可以尝试：扩大位次范围、勾选"展示所有结果"、减少标签筛选。</p>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {results.slice(0, displayCount).map((group, idx) => {
                    const isFav = !!favorites.find(f => f.id === `${group.schoolCode}_${group.majorCode}`);
                    return (
                      <AdmissionResultCard 
                        key={idx}
                        group={group}
                        userRank={profile.rank}
                        isFav={isFav}
                        onToggleFav={handleToggleFav}
                      />
                    );
                  })}
                </div>

                {displayCount < totalMatched && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '100%', marginTop: '20px', marginBottom: '20px' }}
                    onClick={() => setDisplayCount(c => c + PAGE_SIZE)}
                  >
                    展开更多（还有 {totalMatched - displayCount} 条）
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RecommendByRank;

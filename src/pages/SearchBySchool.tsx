import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admissionRepository } from '../services/admissionRepository';
import { type GroupedAdmission } from '../utils/admissionGrouping';
import type { UserProfile } from '../types/user';
import { useAdmissionData } from '../context/AdmissionDataContext';
import type { AdmissionSearchFilters } from '../types/search';
import type { FavoriteItem } from '../types/favorite';
import AdmissionResultCard from '../components/AdmissionResultCard';
import { useSchoolMetadata } from '../hooks/useSchoolMetadata';
import { SCHOOL_FILTER_TAGS } from '../data/schoolMetadata';

const PAGE_SIZE = 50;

const SearchBySchool: React.FC = () => {
  const navigate = useNavigate();
  const { status: admissionStatus } = useAdmissionData();
  const { getSchoolMetadata } = useSchoolMetadata();
  
  const [filters, setFilters] = useState<AdmissionSearchFilters>({
    schoolKeyword: ''
  });

  const [results, setResults] = useState<GroupedAdmission[]>([]);
  const [totalMatched, setTotalMatched] = useState(0);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

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
    if (admissionStatus !== 'ready') return;
    setLoading(true);
    setSearched(true);
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
          <h1 style={{ fontSize: '17px' }}>按学校查询</h1>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
            山东 2023–2025 普通类常规批第1次志愿
          </div>
        </div>
      </header>
      <div className="page-container">
        {/* 数据初始化提示 */}
        {admissionStatus !== 'ready' && (
          <div className="notice-bar notice-bar--warning">
            📥 本地录取库正在初始化，完成后即可查询，请稍候……
          </div>
        )}

        {/* 基础筛选 */}
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px' }}>
            基础筛选
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              学校名称关键词
            </label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="输入学校名称，如：山东大学" 
              value={filters.schoolKeyword}
              onChange={e => setFilters({...filters, schoolKeyword: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              城市（空格分隔多个城市）
            </label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="如：青岛 烟台" 
              value={filters.cityKeywords?.join(' ') || ''}
              onChange={e => setFilters({...filters, cityKeywords: e.target.value.split(/\s+/).filter(Boolean)})}
            />
          </div>

          {/* 高级筛选 */}
          <details style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
            <summary style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', outline: 'none', color: 'var(--text-secondary)', userSelect: 'none' }}>
              高级筛选（点击展开）
            </summary>
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>学校标签（多选则取交集）</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                      padding: '5px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      border: '1px solid var(--border-color)',
                      background: filters.selectedSchoolTags?.includes(t) ? 'var(--primary-color)' : 'white',
                      color: filters.selectedSchoolTags?.includes(t) ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      minHeight: '32px',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={filters.showCityUnconfirmed !== false} 
                    onChange={e => setFilters({...filters, showCityUnconfirmed: e.target.checked})}
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  />
                  展示城市位置待确认的学校（跨校区高校）
                </label>
              </div>
            </div>
          </details>

          <button
            className="btn"
            onClick={handleSearch}
            disabled={admissionStatus !== 'ready' || loading}
          >
            {loading
              ? '正在查找，请稍候……'
              : admissionStatus !== 'ready'
              ? '等待数据初始化……'
              : '查询'}
          </button>
        </div>

        {/* 数据范围说明 */}
        <div className="notice-bar notice-bar--info" style={{ fontSize: '12px' }}>
          ℹ️ 本页只根据 2023–2025 山东普通类常规批第1次志愿投档数据查询。参考标签为历史数据比较，不是结果预测。
        </div>

        {/* 结果提示 */}
        {searched && !loading && (
          <>
            {totalMatched > 0 ? (
              <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                找到 <strong>{totalMatched}</strong> 条匹配结果，当前展示前 {Math.min(displayCount, totalMatched)} 条。<br/>
                <span style={{ fontSize: '12px' }}>排序依据：最新年份最低位次（位次数字越小，录取门槛越高）</span>
              </div>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <p style={{ marginBottom: '8px', fontWeight: 500 }}>没有找到符合条件的候选项</p>
                  <p>可以尝试：更换学校名称关键词、清除标签筛选，或进入「学校库」直接浏览。</p>
                </div>
              </div>
            )}
          </>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {results.slice(0, displayCount).map((group, idx) => {
            const isFav = !!favorites.find(f => f.id === `${group.schoolCode}_${group.majorCode}`);
            return (
              <AdmissionResultCard 
                key={idx}
                group={group}
                userRank={profile?.rank}
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
      </div>
    </div>
  );
};

export default SearchBySchool;

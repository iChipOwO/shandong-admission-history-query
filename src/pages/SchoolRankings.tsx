import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useRankingSubject,
  RANK_DISPLAY_PREF_KEY,
  SOFT_SCIENCE_MAIN_SOURCE_ID,
  ALUMNI_MAIN_SOURCE_ID,
  SOFT_SCIENCE_PREFIX,
} from '../hooks/useRankingSubject';
import type { RankingSource, SchoolRankingData } from '../types/ranking';
import DisclaimerBar from '../components/DisclaimerBar';

// ─── 来源排序 ──────────────────────────────────────────────────────────────────
// 1. 软科主榜  2. 校友会  3. 其他软科分类榜  4. 其他
function sortSources(sources: RankingSource[]): RankingSource[] {
  return [...sources].sort((a, b) => {
    const rank = (s: RankingSource): number => {
      if (s.sourceId === SOFT_SCIENCE_MAIN_SOURCE_ID) return 0;          // 软科主榜
      if (s.sourceId === ALUMNI_MAIN_SOURCE_ID) return 1;                // 校友会
      if (s.sourceId.startsWith(SOFT_SCIENCE_PREFIX)) return 2;          // 其他软科
      return 3;
    };
    return rank(a) - rank(b);
  });
}

// ─── 找默认来源（进入页面时使用：软科主榜优先） ───────────────────────────────
function resolveDefaultSourceId(sources: RankingSource[]): string {
  const sorted = sortSources(sources);
  return sorted[0]?.sourceId ?? SOFT_SCIENCE_MAIN_SOURCE_ID;
}

// ─── 简短显示名称 ──────────────────────────────────────────────────────────────
function sourceLabel(src: RankingSource): string {
  const name = src.sourceName.replace('中国大学排名', '').replace('2025', '').trim();
  const cat = src.category;
  if (cat === '主榜') return `${src.sourceName.includes('软科') ? '软科' : name}中国大学排名（主榜）`;
  return `${src.sourceName.includes('软科') ? '软科' : name}${cat}`;
}

// ─── 获取某校在指定来源的排名 ──────────────────────────────────────────────────
function getRankForSourceId(
  school: SchoolRankingData,
  sourceId: string,
): { rank: number; rankDisplay: string; sourceName: string; category: string; sourceConfidence: string } | null {
  const rankings = school.rankings || [];
  const found = rankings.find(r => r.sourceId === sourceId && r.rank > 0 && r.rank < 9999);
  return found
    ? { rank: found.rank, rankDisplay: found.rankDisplay, sourceName: found.sourceName, category: found.category, sourceConfidence: found.sourceConfidence }
    : null;
}

// ─── Main component ────────────────────────────────────────────────────────────
const SchoolRankings: React.FC = () => {
  const navigate = useNavigate();
  const { status, rankingList, rankingSources } = useRankingSubject();

  const sortedSources = useMemo(() => sortSources(rankingSources), [rankingSources]);

  // 默认来源：直接取软科主榜（不再显示 auto）
  const [selectedSourceId, setSelectedSourceId] = useState<string>(() => {
    const saved = localStorage.getItem(RANK_DISPLAY_PREF_KEY);
    // 只恢复合法 sourceId，auto/hidden 不用于页面来源选择器
    if (saved && saved !== 'auto' && saved !== 'hidden') return saved;
    return SOFT_SCIENCE_MAIN_SOURCE_ID;
  });

  // 数据就绪后，如果当前 selectedSourceId 不在列表里，回退到第一个
  useEffect(() => {
    if (status !== 'ready' || sortedSources.length === 0) return;
    if (!sortedSources.find(s => s.sourceId === selectedSourceId)) {
      const fallback = resolveDefaultSourceId(sortedSources);
      setSelectedSourceId(fallback);
      localStorage.setItem(RANK_DISPLAY_PREF_KEY, fallback);
    }
  }, [status, sortedSources, selectedSourceId]);

  // 滚动至顶部
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [showNoRanking, setShowNoRanking] = useState(false);
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);

  // 省份列表
  const provinces = useMemo(() => {
    const set = new Set<string>();
    for (const s of rankingList) {
      if (s.province) set.add(s.province);
    }
    return Array.from(set).sort();
  }, [rankingList]);

  const commonTags = ['985', '211', '双一流', '公办', '民办', '本科'];

  // 按选定来源获取排名（列表内）
  const getRankForSchool = (school: SchoolRankingData) => getRankForSourceId(school, selectedSourceId);

  // 当前来源信息（用于按钮显示）
  const currentSource = useMemo(
    () => sortedSources.find(s => s.sourceId === selectedSourceId),
    [sortedSources, selectedSourceId]
  );

  const currentSourceLabel = currentSource ? sourceLabel(currentSource) : '选择来源';

  const rankTieCounts = useMemo(() => {
    const counts = new Map<number, number>();
    const seenSchools = new Set<string>();
    for (const school of rankingList) {
      const key = school.schoolName.trim();
      if (seenSchools.has(key)) continue;
      seenSchools.add(key);
      const rankInfo = getRankForSourceId(school, selectedSourceId);
      if (!rankInfo) continue;
      counts.set(rankInfo.rank, (counts.get(rankInfo.rank) ?? 0) + 1);
    }
    return counts;
  }, [rankingList, selectedSourceId]);

  // 过滤后列表
  const filteredList = useMemo(() => {
    let list = rankingList;

    if (selectedProvince) list = list.filter(s => s.province === selectedProvince);
    if (selectedTag) list = list.filter(s => (s.schoolTypeTags || []).includes(selectedTag));
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      list = list.filter(s => s.schoolName.toLowerCase().includes(kw));
    }
    if (!showNoRanking) {
      list = list.filter(s => getRankForSourceId(s, selectedSourceId) !== null);
    }

    // 去重，以 normalized schoolName 为主键
    const seen = new Set<string>();
    const uniqueList: SchoolRankingData[] = [];
    for (const s of list) {
      // 按学校名称去重，因为有些学校有多个 schoolCode（如医学部等）但在同一份排名里不应该出现多行。
      // 分校区（如哈工大威海）名称本身就不同，不会被误合并。
      const key = s.schoolName.trim();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueList.push(s);
      }
    }
    list = uniqueList;

    list = [...list].sort((a, b) => {
      const ra = getRankForSourceId(a, selectedSourceId);
      const rb = getRankForSourceId(b, selectedSourceId);
      if (ra && rb) return ra.rank - rb.rank;
      if (ra) return -1;
      if (rb) return 1;
      return a.schoolName.localeCompare(b.schoolName, 'zh');
    });

    return list;
  }, [rankingList, selectedProvince, selectedTag, searchKeyword, showNoRanking, selectedSourceId]);

  const handleSourceChange = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    localStorage.setItem(RANK_DISPLAY_PREF_KEY, sourceId);
    setShowSourceDrawer(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}
        >←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '17px' }}>学校排名</h1>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>参考榜单汇总</div>
        </div>
      </header>

      <div className="page-container" style={{ flex: 1 }}>

        {/* 说明 */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '12px',
          color: '#1e40af',
          lineHeight: 1.65,
          marginBottom: '12px',
        }}>
          ℹ️ 不同排行榜评价口径不同，排名仅作为横向参考，不参与录取判断。
          <br />
          分校区、医学部、军校/警校等特殊招生实体通常不自动继承本部排名。
          <br />
          排名按榜单原始名次展示，可能存在并列名次。
        </div>

        {/* 加载中 / 错误 */}
        {status === 'loading' && (
          <div className="loading-state">📥 排名数据加载中，请稍候……</div>
        )}
        {status === 'error' && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', color: '#b91c1c', fontSize: '13px' }}>
            ⚠️ 排名数据加载失败，请刷新重试。
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* 来源选择按钮 */}
            <div style={{ marginBottom: '12px' }}>
              <button
                onClick={() => setShowSourceDrawer(true)}
                onMouseEnter={e => e.currentTarget.style.background = '#e0e7ff'}
                onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.99)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#1e3a8a',
                  textAlign: 'left',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  transition: 'background 0.2s, transform 0.1s',
                }}
              >
                <span>
                  <span style={{ fontSize: '11px', color: '#3b82f6', marginRight: '6px' }}>来源：</span>
                  <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{currentSourceLabel}</span>
                  {currentSource?.sourceConfidence === 'secondary_mirror' && (
                    <span style={{ fontSize: '10px', color: '#b45309', marginLeft: '5px' }}>二级整理</span>
                  )}
                </span>
                <span style={{ color: '#60a5fa', fontSize: '14px', fontWeight: 'bold' }}>▾</span>
              </button>
            </div>

            {/* 搜索 + 筛选 */}
            <div className="card" style={{ marginBottom: '12px', padding: '12px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="搜索学校名称"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                style={{ marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="form-control"
                  value={selectedProvince}
                  onChange={e => setSelectedProvince(e.target.value)}
                  style={{ flex: '1 1 120px', minWidth: '100px' }}
                >
                  <option value="">全部省份</option>
                  {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  className="form-control"
                  value={selectedTag}
                  onChange={e => setSelectedTag(e.target.value)}
                  style={{ flex: '1 1 120px', minWidth: '100px' }}
                >
                  <option value="">全部类型</option>
                  {commonTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="showNoRanking"
                  checked={showNoRanking}
                  onChange={e => setShowNoRanking(e.target.checked)}
                />
                <label htmlFor="showNoRanking" style={{ fontSize: '13px', cursor: 'pointer' }}>
                  显示暂无排名学校（{rankingList.filter(s => !s.rankingCoverage?.hasAnyRanking).length} 所）
                </label>
              </div>
            </div>

            {/* 结果数量 */}
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              共 {filteredList.length} 所学校
            </div>

            {/* 学校列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredList.map(school => {
                const rankInfo = getRankForSchool(school);
                const tags = school.schoolTypeTags || [];
                const rankText = rankInfo
                  ? (rankTieCounts.get(rankInfo.rank) ?? 0) > 1
                    ? `并列第${rankInfo.rank}`
                    : String(rankInfo.rank)
                  : '—';
                return (
                  <div
                    key={school.schoolCode}
                    className="card"
                    style={{ padding: '10px 12px', cursor: 'pointer' }}
                    onClick={() => navigate(`/schools/${encodeURIComponent(school.schoolCode || school.schoolName)}?schoolName=${encodeURIComponent(school.schoolName)}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      {/* 排名数字 */}
                      <div style={{
                        flexShrink: 0,
                        minWidth: rankText.startsWith('并列') ? '58px' : '44px',
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: rankInfo ? (rankText.startsWith('并列') ? '13px' : '18px') : '13px',
                        color: rankInfo ? 'var(--primary-color)' : '#9ca3af',
                        lineHeight: 1.3,
                        paddingTop: '2px',
                      }}
                        title={rankInfo ? `${rankInfo.sourceName}原始名次：${rankInfo.rankDisplay}` : ''}
                      >
                        {rankText}
                      </div>
                      {/* 学校信息 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
                          {school.schoolName}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          {school.province}{school.province !== school.city && school.city ? `｜${school.city}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {tags.slice(0, 4).map(tag => (
                            <span key={tag} style={{
                              background: tag === '985' ? '#fef3c7' : tag === '211' ? '#dbeafe' : tag === '双一流' ? '#f3e8ff' : '#f1f5f9',
                              color: tag === '985' ? '#92400e' : tag === '211' ? '#1e40af' : tag === '双一流' ? '#6b21a8' : '#64748b',
                              padding: '1px 6px', borderRadius: '99px', fontSize: '11px', fontWeight: 500,
                            }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredList.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px', fontSize: '14px' }}>
                  未找到符合条件的学校
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── 来源选择抽屉 ────────────────────────────────────────────── */}
      {showSourceDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17,24,39,0.36)',
            zIndex: 2200,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setShowSourceDrawer(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'white',
              borderRadius: '16px 16px 0 0',
              padding: '0 0 env(safe-area-inset-bottom, 0)',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.14)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 抽屉头 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 16px 12px',
              borderBottom: '1px solid #f1f5f9',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>选择排名来源</span>
              <button
                onClick={() => setShowSourceDrawer(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
              >×</button>
            </div>

            {/* 来源列表（可滚动） */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {sortedSources.map(src => {
                const isSelected = selectedSourceId === src.sourceId;
                const label = sourceLabel(src);
                return (
                  <button
                    key={src.sourceId}
                    onClick={() => handleSourceChange(src.sourceId)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '13px 16px',
                      border: 'none',
                      borderBottom: '1px solid #f8fafc',
                      background: isSelected ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {/* 选中指示 */}
                    <span style={{
                      flexShrink: 0,
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? 'var(--primary-color)' : '#e2e8f0'}`,
                      background: isSelected ? 'var(--primary-color)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isSelected && (
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'white', display: 'block' }} />
                      )}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--primary-color)' : 'var(--text-primary)' }}>
                        {label}
                      </div>
                      {src.sourceConfidence === 'secondary_mirror' && (
                        <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>
                          ⚠ 二级整理来源，数据精准度可能低于官方
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* 分隔线 + 隐藏标签选项（放在抽屉底部） */}
              <div style={{ padding: '10px 16px 4px', borderTop: '1px solid #f1f5f9', marginTop: '4px' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>查询卡片设置</div>
              </div>
              <button
                onClick={() => {
                  localStorage.setItem(RANK_DISPLAY_PREF_KEY, 'hidden');
                  setShowSourceDrawer(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: '1px solid #f8fafc',
                  background: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#6b7280',
                  fontSize: '13px',
                }}
              >
                <span style={{ fontSize: '16px' }}>🚫</span>
                查询卡片不展示排名标签
                <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>仅影响查询/报告页</span>
              </button>

              <div style={{ height: '16px' }} />
            </div>
          </div>
        </div>
      )}
      
      <DisclaimerBar />
    </div>
  );
};

export default SchoolRankings;

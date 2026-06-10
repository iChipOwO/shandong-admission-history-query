import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSchoolMetadata } from '../hooks/useSchoolMetadata';
import { useAdmissionData } from '../context/AdmissionDataContext';
import { admissionRepository } from '../services/admissionRepository';
import type { GroupedAdmission } from '../utils/admissionGrouping';
import { groupRecordsBySchoolMajor, sortByLatestMinRank } from '../utils/admissionGrouping';
import AdmissionResultCard from '../components/AdmissionResultCard';
import type { FavoriteItem } from '../types/favorite';
import type { UserProfile } from '../types/user';
import { useRankingSubject } from '../hooks/useRankingSubject';
import { GRADE_ORDER } from '../types/ranking';
import DisclaimerBar from '../components/DisclaimerBar';

const PAGE_SIZE = 50;

const SchoolDetail: React.FC = () => {
  const { schoolCode } = useParams<{ schoolCode: string }>();
  const [searchParams] = useSearchParams();
  const fallbackSchoolName = searchParams.get('schoolName');
  const navigate = useNavigate();
  const { status: admissionStatus } = useAdmissionData();
  const { status: metadataStatus, getSchoolMetadata } = useSchoolMetadata();
  const { getAllRankings, getSubjectEval, status: rankingStatus } = useRankingSubject();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [majorKeyword, setMajorKeyword] = useState('');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

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

  const decodedParam = schoolCode ? decodeURIComponent(schoolCode) : '';
  const schoolMeta = getSchoolMetadata(decodedParam, fallbackSchoolName || decodedParam);

  const [records, setRecords] = useState<GroupedAdmission[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [schoolCode, fallbackSchoolName]);

  useEffect(() => {
    if (admissionStatus === 'ready' && schoolMeta) {
      const all = admissionRepository.getAllRecords();
      const matched = all.filter(r => 
        (schoolMeta.schoolCode && r.schoolCode === schoolMeta.schoolCode) || 
        r.schoolName === schoolMeta.schoolName
      );
      const grouped = groupRecordsBySchoolMajor(matched);
      const sorted = sortByLatestMinRank(grouped, true);
      setRecords(sorted);
    }
  }, [admissionStatus, schoolMeta]);

  const filteredRecords = useMemo(() => {
    if (!majorKeyword) return records;
    const kw = majorKeyword.toLowerCase();
    return records.filter(r => r.majorName.toLowerCase().includes(kw));
  }, [records, majorKeyword]);

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

  const isFavSchool = !!schoolMeta && !!favorites.find(f => f.type === 'school' && f.schoolCode === schoolMeta.schoolCode);

  const handleToggleSchoolFav = () => {
    if (!schoolMeta || !schoolMeta.schoolCode) return;
    const id = `school_${schoolMeta.schoolCode}`;
    let newFavs;
    if (isFavSchool) {
      newFavs = favorites.filter(f => f.id !== id);
    } else {
      newFavs = [...favorites, {
        id,
        type: 'school',
        schoolCode: schoolMeta.schoolCode,
        schoolName: schoolMeta.schoolName,
        province: schoolMeta.province,
        city: schoolMeta.city,
        createdAt: new Date().toISOString()
      } as FavoriteItem];
    }
    setFavorites(newFavs);
    localStorage.setItem('gaokao_favorites', JSON.stringify(newFavs));
  };

  if (metadataStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="header">
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
          <h1 style={{ fontSize: '17px' }}>学校详情</h1>
        </header>
        <div className="page-container" style={{ flex: 1 }}>
          <div className="loading-state">📥 学校信息加载中，请稍候……</div>
        </div>
        <DisclaimerBar />
      </div>
    );
  }

  if (!schoolMeta) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="header">
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '16px', marginRight: '10px' }}>&lt; 返回</button>
          <h1>学校详情</h1>
        </header>
        <div className="page-container" style={{ flex: 1 }}>
          <div className="card">
            <p>找不到指定的学校信息: {decodedParam || fallbackSchoolName}</p>
          </div>
        </div>
        <DisclaimerBar />
      </div>
    );
  }

  const tags = schoolMeta.schoolTypeTags || [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '17px' }}>学校详情</h1>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>山东 2023–2025 普通类常规批第1次志愿</div>
        </div>
      </header>
      <div className="page-container" style={{ flex: 1 }}>
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 style={{ fontSize: '20px', color: 'var(--primary-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {schoolMeta.schoolName}
              <button 
                onClick={handleToggleSchoolFav}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '24px' }}
                title={isFavSchool ? '取消收藏' : '收藏该学校'}
              >
                {isFavSchool ? '★' : '☆'}
              </button>
            </h2>
          </div>
          
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ color: '#374151', fontWeight: 500 }}>{schoolMeta.province}{schoolMeta.province !== schoolMeta.city && schoolMeta.city ? `｜${schoolMeta.city}` : ''}{schoolMeta.cityConfirmed === false ? '(待确认)' : ''}</span>
            {tags.length > 0 && <span>｜ {tags.join(' ｜ ')}</span>}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {schoolMeta.department && <div>主管部门: {schoolMeta.department}</div>}
            {schoolMeta.educationLevel && <div>办学层次: {schoolMeta.educationLevel}</div>}
            {schoolMeta.note && <div style={{ color: '#b45309' }}>备注: {schoolMeta.note}</div>}
            {schoolMeta.sourceName && <div>基础信息来源: {schoolMeta.sourceName}</div>}
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {schoolMeta.officialWebsiteUrl && <a href={schoolMeta.officialWebsiteUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>官方链接</a>}
              {schoolMeta.admissionWebsiteUrl && <a href={schoolMeta.admissionWebsiteUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>招生网</a>}
              {schoolMeta.baikeUrl && <a href={schoolMeta.baikeUrl} target="_blank" rel="noreferrer" style={{ color: '#6b7280' }}>百度百科(第三方参考)</a>}
              {schoolMeta.wikipediaUrl && <a href={schoolMeta.wikipediaUrl} target="_blank" rel="noreferrer" style={{ color: '#6b7280' }}>维基百科(第三方参考)</a>}
            </div>
          </div>
        </div>

        <div className="notice-bar notice-bar--info" style={{ fontSize: '12px' }}>
          ℹ️ 本页展示的是该校在山东普通类常规批第1次志愿中的投档数据，不代表该校在全国所有省份的录取情况。
        </div>

        {/* ── 学校排名 ─────────────────────────────────────────────────── */}
        {(() => {
          if (rankingStatus !== 'ready') return null;
          const allRankings = getAllRankings(schoolMeta.schoolCode, schoolMeta.schoolName);
          const validRankings = allRankings.filter(r => r.rank > 0 && r.rank < 9999);
          if (validRankings.length === 0) return (
            <div className="card" style={{ marginBottom: '16px', padding: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>🏆 学校排名</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>暂无收录排名</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>分校区、医学部、军校/警校等特殊招生实体通常不自动继承本部排名。</div>
            </div>
          );
          return (
            <div className="card" style={{ marginBottom: '16px', padding: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>🏆 学校排名</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>分校区、医学部、军校/警校等特殊招生实体通常不自动继承本部排名。排名仅作为横向参考，不参与录取判断。</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {validRankings.map((r, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--primary-color)', minWidth: '36px', textAlign: 'center' }}>{r.rank}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#374151' }}>{r.sourceName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.year} · {r.category}
                        {r.sourceConfidence === 'secondary_mirror' && (
                          <span style={{ marginLeft: '6px', color: '#b45309' }}>(二级整理来源)</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── 第四轮学科评估 ──────────────────────────────────────────── */}
        {(() => {
          if (rankingStatus !== 'ready') return null;
          const subjects = getSubjectEval(schoolMeta.schoolCode, schoolMeta.schoolName);
          if (subjects.length === 0) return null;
          const gradeGroups: Record<string, string[]> = {};
          for (const g of GRADE_ORDER) gradeGroups[g] = [];
          for (const s of subjects) {
            if (gradeGroups[s.grade]) gradeGroups[s.grade].push(s.subjectName);
          }
          const GRADE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
            'A+': { bg: '#fefce8', color: '#854d0e', border: '#fde047' },
            'A':  { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
            'A-': { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
            'B+': { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' },
            'B':  { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' },
            'B-': { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' },
            'C+': { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
            'C':  { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
            'C-': { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
          };
          return (
            <div className="card" style={{ marginBottom: '16px', padding: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>📊 第四轮学科评估</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>学科评估反映一级学科建设水平，不等同于本科专业排名。</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {GRADE_ORDER.map(grade => {
                  const list = gradeGroups[grade];
                  if (!list || list.length === 0) return null;
                  const colors = GRADE_COLORS[grade];
                  return (
                    <div key={grade} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{
                        flexShrink: 0,
                        background: colors.bg, color: colors.color, border: `1px solid ${colors.border}`,
                        borderRadius: '5px', padding: '2px 7px', fontSize: '12px', fontWeight: 700, minWidth: '30px', textAlign: 'center',
                      }}>{grade}</span>
                      <div style={{ flex: 1, fontSize: '12px', color: '#374151', lineHeight: 1.7 }}>
                        {list.join('、')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="card" style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>专业关键词搜索</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="如：计算机" 
            value={majorKeyword}
            onChange={e => { setMajorKeyword(e.target.value); setDisplayCount(PAGE_SIZE); }}
          />
        </div>

        <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {admissionStatus !== 'ready' ? '正在加载历年投档数据...' : `共找到 ${filteredRecords.length} 个专业/专业类记录。`}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredRecords.slice(0, displayCount).map((group, idx) => {
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

        {displayCount < filteredRecords.length && (
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', marginTop: '20px', marginBottom: '20px' }}
            onClick={() => setDisplayCount(c => c + PAGE_SIZE)}
          >
            展开更多
          </button>
        )}
      </div>
      <DisclaimerBar />
    </div>
  );
};

export default SchoolDetail;

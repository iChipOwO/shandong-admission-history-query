import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { FavoriteItem } from '../types/favorite';
import { useAdmissionData } from '../context/AdmissionDataContext';
import { admissionRepository } from '../services/admissionRepository';
import AdmissionResultCard from '../components/AdmissionResultCard';
import type { GroupedAdmission } from '../utils/admissionGrouping';
import type { UserProfile } from '../types/user';

import DisclaimerBar from '../components/DisclaimerBar';

const Favorites: React.FC = () => {
  const navigate = useNavigate();
  const { status } = useAdmissionData();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'school' | 'choice'>('school');

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_favorites');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((item: any) => {
          if (item.addedAt && !item.createdAt) {
            return { ...item, createdAt: item.addedAt };
          }
          return item;
        });
        setFavorites(migrated);
        if (parsed.some((item: any) => item.addedAt && !item.createdAt)) {
          localStorage.setItem('gaokao_favorites', JSON.stringify(migrated));
        }
      } catch (e) {}
    }
    const savedProfile = localStorage.getItem('gaokao_user_profile');
    if (savedProfile) {
      try { setProfile(JSON.parse(savedProfile)); } catch (e) {}
    }
  }, []);

  const handleToggleFav = (group: GroupedAdmission) => {
    const id = `${group.schoolCode}_${group.majorCode}`;
    const newFavs = favorites.filter(f => f.id !== id);
    setFavorites(newFavs);
    localStorage.setItem('gaokao_favorites', JSON.stringify(newFavs));
  };

  const removeFav = (id: string) => {
    const newFavs = favorites.filter(f => f.id !== id);
    setFavorites(newFavs);
    localStorage.setItem('gaokao_favorites', JSON.stringify(newFavs));
  };

  const choiceFavs = favorites.filter(f => f.type === 'choice' || !f.type);
  const schoolFavs = favorites.filter(f => f.type === 'school');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header" style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
        <h1 style={{ flex: 1 }}>我的收藏</h1>
        <button 
          onClick={() => setActiveTab(activeTab === 'school' ? 'choice' : 'school')}
          style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px', color: 'white', fontSize: '13px', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {activeTab === 'school' ? '切换志愿' : '切换学校'}
        </button>
      </header>
      <div className="page-container" style={{ flex: 1 }}>

        {activeTab === 'school' && (
          schoolFavs.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">🏫</div>
                <p style={{ marginBottom: '8px', fontWeight: 500 }}>暂无学校收藏</p>
                <p>可以在学校库中点击 ☆ 收藏学校。</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {schoolFavs.map((fav) => (
                <div key={fav.id} className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      to={`/schools/${fav.schoolCode || fav.schoolName}`}
                      style={{ fontWeight: 600, fontSize: '15px', color: 'var(--primary-color)', textDecoration: 'none' }}
                    >
                      {fav.schoolName}
                    </Link>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {fav.province}{fav.province !== fav.city && fav.city ? ` ｜ ${fav.city}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '12px', width: 'auto', minHeight: '36px' }}
                      onClick={() => navigate(`/schools/${fav.schoolCode || fav.schoolName}`)}
                    >
                      查看
                    </button>
                    <button 
                      style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer', minHeight: '36px' }}
                      onClick={() => removeFav(fav.id)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'choice' && (
          choiceFavs.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">⭐</div>
                <p style={{ marginBottom: '8px', fontWeight: 500 }}>暂无志愿收藏</p>
                <p>可以在查询页点击 ☆ 收藏志愿项。</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {choiceFavs.map((fav) => {
                let groupData: GroupedAdmission | null = null;
                if (status === 'ready') {
                  const all = admissionRepository.getAllRecords();
                  const matched = all.filter(r => r.schoolCode === fav.schoolCode && r.majorCode === fav.majorCode);
                  if (matched.length > 0) {
                    const recordsByYear: any = {};
                    matched.forEach(m => { recordsByYear[m.year] = m; });
                    groupData = {
                      schoolCode: fav.schoolCode!,
                      schoolName: fav.schoolName!,
                      majorCode: fav.majorCode!,
                      majorName: fav.majorName!,
                      records: recordsByYear,
                      latestRecord: matched.reduce((prev, curr) => (curr.year > prev.year ? curr : prev))
                    };
                  }
                }

                return (
                  <div key={fav.id}>
                    {status !== 'ready' ? (
                      <div className="card loading-state" style={{ border: '1px solid var(--border-color)' }}>📥 录取库加载中，请稍候……</div>
                    ) : groupData ? (
                      <AdmissionResultCard 
                        group={groupData}
                        userRank={profile?.rank}
                        isFav={true}
                        onToggleFav={handleToggleFav}
                        showDetails={false}
                        hideDetailsToggle={false}
                      />
                    ) : (
                      <div className="card" style={{ fontSize: '13px', color: '#92400e', background: '#fef3c7', padding: '10px 12px', borderRadius: '6px', lineHeight: 1.6, border: '1px solid #fcd34d' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{fav.schoolName} - {fav.majorName}</div>
                        ⚠️ 当前录取库中未找到该收藏项，可能是专业名称或数据版本变化。
                        <button onClick={() => removeFav(fav.id)} style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', cursor: 'pointer' }}>删除此收藏</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
      
      <DisclaimerBar />
    </div>
  );
};

export default Favorites;

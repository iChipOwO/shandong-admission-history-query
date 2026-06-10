import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '../types/user';
import { defaultProfile } from '../types/user';

const SUBJECTS = ['物理', '化学', '生物', '政治', '历史', '地理'];

const ProfileForm: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_user_profile');
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  const handleSubjectChange = (subject: string) => {
    setProfile(prev => {
      const subjects = prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject];
      return { ...prev, subjects };
    });
    setIsDirty(true);
  };

  const [showSavedToast, setShowSavedToast] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gaokao_user_profile', JSON.stringify(profile));
    setIsDirty(false);
    navigate('/');
  };

  const handleSaveOnly = () => {
    localStorage.setItem('gaokao_user_profile', JSON.stringify(profile));
    setIsDirty(false);
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
    }, 2000);
  };

  const handleBackClick = () => {
    if (isDirty) {
      setShowConfirm(true);
    } else {
      navigate('/');
    }
  };

  const handleSaveAndLeave = () => {
    localStorage.setItem('gaokao_user_profile', JSON.stringify(profile));
    setIsDirty(false);
    navigate('/');
  };

  const handleLeaveWithoutSaving = () => {
    setIsDirty(false);
    navigate('/');
  };

  const handleContinueEditing = () => {
    setShowConfirm(false);
  };

  return (
    <div>
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={handleBackClick} style={{ background: 'none', border: 'none', color: 'white', fontSize: '16px' }}>&lt; 返回</button>
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '1.2rem' }}>我的信息</h1>
        <button type="button" onClick={handleSaveOnly} style={{ background: 'var(--primary-color, #3b82f6)', border: 'none', color: 'white', padding: '6px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>保存</button>
      </header>
      
      {showSavedToast && (
        <div style={{ position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0, 0, 0, 0.7)', color: 'white', padding: '8px 16px', borderRadius: '20px', zIndex: 100, fontSize: '14px' }}>
          已保存
        </div>
      )}

      <div className="page-container">
        <form id="profile-form" onSubmit={handleSubmit}>
          <div className="card">
            <div className="form-group">
              <label>省份</label>
              <input type="text" className="form-control" value="山东" disabled />
            </div>
            <div className="form-group">
              <label>高考年份</label>
              <select name="examYear" className="form-control" value={profile.examYear} onChange={handleChange}>
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2027}>2027</option>
              </select>
            </div>
            <div className="form-group">
              <label>全省位次 (重要)</label>
              <input type="number" name="rank" className="form-control" value={profile.rank || ''} onChange={handleChange} placeholder="例如：12000" />
            </div>
          </div>

          <div className="card">
            <div className="form-group">
              <label>选科 (多选)</label>
              <div className="checkbox-group">
                {SUBJECTS.map(sub => (
                  <label key={sub} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={profile.subjects.includes(sub)}
                      onChange={() => handleSubjectChange(sub)}
                    />
                    {sub}
                  </label>
                ))}
              </div>
            </div>
          </div>



          <button type="submit" className="btn">保存并返回</button>
        </form>
      </div>

      {showConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            background: 'white', padding: '20px', borderRadius: '8px',
            width: '300px', maxWidth: '90%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>未保存提示</h3>
            <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>你修改了信息但尚未保存，是否保存后离开？</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="button" onClick={handleSaveAndLeave} style={{ padding: '10px', background: 'var(--primary-color, #3b82f6)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>保存并离开</button>
              <button type="button" onClick={handleLeaveWithoutSaving} style={{ padding: '10px', background: '#f5f5f5', color: '#666', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>不保存离开</button>
              <button type="button" onClick={handleContinueEditing} style={{ padding: '10px', background: 'white', color: '#3b82f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>继续编辑</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileForm;

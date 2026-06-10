import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { UserProfile } from '../types/user';
import { useAdmissionData } from '../context/AdmissionDataContext';
import { useSchoolMetadata } from '../hooks/useSchoolMetadata';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useDataCacheStatus } from '../hooks/useDataCacheStatus';
import InstallPrompt from '../components/InstallPrompt';
import DisclaimerBar from '../components/DisclaimerBar';

const GUIDE_KEY = 'gaokao_first_guide_dismissed';

const Home: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const navigate = useNavigate();
  const { status: admissionStatus, retry: retryAdmission } = useAdmissionData();
  const { status: metadataStatus } = useSchoolMetadata();
  const onlineStatus = useOnlineStatus();
  const dataCacheStatus = useDataCacheStatus();

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_user_profile');
    if (saved) {
      try { setProfile(JSON.parse(saved)); } catch (e) { /* ignore */ }
    }
    const dismissed = localStorage.getItem(GUIDE_KEY);
    if (!dismissed) setGuideVisible(true);
  }, []);

  const dismissGuide = () => {
    setGuideVisible(false);
    localStorage.setItem(GUIDE_KEY, '1');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <h1 style={{ fontSize: '20px' }}>23~25年录取信息查询</h1>
        <span style={{
          fontSize: '12px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '99px',
          padding: '2px 10px',
          color: 'rgba(255,255,255,0.9)',
        }}>
          山东 ｜ 往届公开录取数据 ｜ 普通类常规批第1次
        </span>
      </header>

      <div className="page-container">

        {/* ── 数据加载中提示 ─────────────────────────── */}
        {(admissionStatus === 'loading' || metadataStatus === 'loading' ||
          admissionStatus === 'idle' || metadataStatus === 'idle') && (
          <div className="notice-bar notice-bar--info">
            📥 本地数据正在初始化，首次加载可能需要几秒，请稍候……
          </div>
        )}

        {/* ── 离线状态提示 ─────────────────────────── */}
        {onlineStatus === 'offline' && (
          <div className="notice-bar notice-bar--warning">
            {dataCacheStatus.admissions && dataCacheStatus.schoolMetadata
              ? '📴 当前离线。录取库和学校信息已缓存，可继续使用。'
              : dataCacheStatus.checked
              ? '📴 当前离线。首次使用请联网完成数据初始化。'
              : '📴 当前离线，正在检查本机缓存状态……'}
          </div>
        )}

        {/* ── 数据错误提示 ─────────────────────────── */}
        {admissionStatus === 'error' && (
          <div className="card" style={{ background: '#fef2f2', borderColor: '#fca5a5', marginBottom: '12px' }}>
            <div style={{ color: '#b91c1c', fontSize: '14px', marginBottom: '8px' }}>⚠️ 录取库初始化失败，查询功能暂不可用。</div>
            <button className="btn" style={{ fontSize: '14px' }} onClick={retryAdmission}>重试加载</button>
          </div>
        )}

        {/* ── PWA 安装提示 ─────────────────────────── */}
        <InstallPrompt />

        {/* ── 首次使用引导 ─────────────────────────── */}
        {guideVisible && (
          <div className="card" style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
            borderColor: '#bfdbfe',
            position: 'relative',
          }}>
            <button
              onClick={dismissGuide}
              style={{
                position: 'absolute', top: '10px', right: '12px',
                background: 'none', border: 'none', fontSize: '18px',
                color: '#9ca3af', cursor: 'pointer', lineHeight: 1, padding: '2px',
              }}
              aria-label="关闭引导"
            >×</button>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e40af', marginBottom: '10px' }}>
              💡 第一次使用建议
            </div>
            <ol style={{ paddingLeft: '20px', fontSize: '13px', color: '#374151', lineHeight: 1.8, margin: 0 }}>
              <li>先填写全省位次和选科，方便个性化比较。</li>
              <li>用专业/学校/位次查询往届录取。</li>
              <li>把感兴趣的专业+学校加入报告。</li>
              <li>在报告中排序、备注，导出给 AI 或老师复核。</li>
              <li>定期导出 JSON 备份，避免清缓存丢失报告。</li>
            </ol>
            <button
              onClick={dismissGuide}
              style={{
                marginTop: '12px', fontSize: '12px', color: '#6b7280',
                background: 'none', border: '1px solid #d1d5db', borderRadius: '6px',
                padding: '4px 12px', cursor: 'pointer',
              }}
            >我知道了，不再显示</button>
          </div>
        )}

        {/* ── 顶部区域：考生信息 + 快捷功能 ─────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          {/* 左侧：考生信息 */}
          <div className="card" style={{ flex: '1 1 300px', margin: 0 }}>
            {profile ? (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>我的考生信息</div>
                <div style={{ marginBottom: '6px' }}>
                  <strong style={{ fontSize: '15px' }}>
                    {profile.province} {profile.examYear} 考生
                  </strong>
                </div>
                <div style={{ fontSize: '20px', color: 'var(--primary-color)', fontWeight: 700, marginBottom: '6px' }}>
                  {profile.rank
                    ? <span title="位次数字越小，录取门槛越高">{profile.rank.toLocaleString()} 位</span>
                    : '未填位次'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  选科：{profile.subjects.length > 0 ? profile.subjects.join(' + ') : '未填'}
                </div>

                <Link to="/profile" className="btn btn-secondary" style={{ display: 'block', textAlign: 'center', fontSize: '14px' }}>
                  修改我的信息
                </Link>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px', paddingLeft: '4px' }}>
                  项目说明
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6 }}>
                  📋 建议先填写全省位次，用于个性化比较。
                </div>
                <Link to="/profile" className="btn" style={{ display: 'block', textAlign: 'center', fontSize: '15px' }}>
                  填写我的信息
                </Link>
              </div>
            )}
          </div>

          {/* 右侧：快捷功能 */}
          <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="menu-item" style={{ flex: 1, minHeight: '44px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontWeight: 600 }} onClick={() => navigate('/reports')}>
              📄 我的报告
            </button>
            <button className="menu-item" style={{ flex: 1, minHeight: '44px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', color: '#92400e', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontWeight: 600 }} onClick={() => navigate('/favorites')}>
              ⭐ 我的收藏
            </button>
            <button className="menu-item" style={{ flex: 1, minHeight: '44px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', color: '#6b21a8', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontWeight: 600 }} onClick={() => navigate('/prompt')}>
              🤖 AI分析 Prompt
            </button>
          </div>
        </div>

        <button
          className="menu-item"
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
            borderColor: '#0284c7',
            color: 'white',
            fontSize: '17px',
            fontWeight: 700,
            padding: '18px 16px',
            borderRadius: '12px',
            marginBottom: '8px',
            boxShadow: '0 4px 12px rgba(2,132,199,0.3)',
          }}
          onClick={() => navigate('/search-major')}
        >
          🎯 往届录取信息查询
          <div style={{ fontSize: '12px', fontWeight: 400, opacity: 0.9, marginTop: '4px' }}>
            按位次、学校、城市和专业方向查询往年录取信息
          </div>
        </button>

        <div style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', marginBottom: '16px', fontStyle: 'italic' }}>
          ✨ 祝你查到有用的信息，也祝你走向喜欢的大学。 ✨
        </div>

        {/* ── 参考工具 ─────────────────────────── */}
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
          参考工具
        </div>
        <div className="menu-grid" style={{ marginBottom: '16px' }}>
          <button
            className="menu-item"
            style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}
            onClick={() => navigate('/rankings')}
          >
            🏆 学校排名
            <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85, marginTop: '2px' }}>软科/校友会榜单</div>
          </button>
          <button
            className="menu-item"
            style={{ background: '#fefce8', color: '#854d0e', borderColor: '#fde047' }}
            onClick={() => navigate('/subjects')}
          >
            📊 学科实力
            <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85, marginTop: '2px' }}>第四轮学科评估</div>
          </button>
          <button
            className="menu-item"
            style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => navigate('/tips')}
          >
            <div>📖 填报常识</div>
            <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85, marginTop: '2px', lineHeight: 1.4 }}>志愿填报注意事项</div>
          </button>
          <button
            className="menu-item"
            style={{ background: '#f3e8ff', color: '#6b21a8', borderColor: '#d8b4fe', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => navigate('/university-life')}
          >
            <div>🎒 关于大学</div>
            <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85, marginTop: '2px', lineHeight: 1.4 }}>新生群、校园卡与开学防坑</div>
          </button>
        </div>

        {/* ── 支持与反馈 ─────────────────────────── */}
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
          支持与反馈
        </div>
        <div style={{ marginBottom: '16px' }}>
          <button
            className="menu-item"
            style={{ width: '100%', background: '#f8fafc', color: '#334155', borderColor: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px' }}
            onClick={() => navigate('/about-author')}
          >
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Bug反馈/联系我</div>
            <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85, marginTop: '4px' }}>反馈 Bug 或使用体验问题</div>
          </button>
        </div>

        {/* ── 数据状态快捷入口 ─────────────────────── */}
        <div style={{ marginTop: '16px', marginBottom: '4px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
          <button
            onClick={() => navigate('/data-status')}
            style={{ background: 'none', border: 'none', padding: 0, color: '#64748b', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            数据状态 / 离线缓存 / 数据来源
          </button>
        </div>

      </div>
      
      <DisclaimerBar />
    </div>
  );
};

export default Home;

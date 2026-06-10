import React from 'react';
import { useNavigate } from 'react-router-dom';
import DisclaimerBar from '../components/DisclaimerBar';

const AboutAuthor: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header" style={{ display: 'flex', alignItems: 'center' }}>
        <button 
          onClick={() => navigate('/')} 
          style={{ 
            background: 'none', border: 'none', color: 'white', 
            fontSize: '15px', cursor: 'pointer', padding: '0 10px 0 0',
            display: 'flex', alignItems: 'center'
          }}
        >
          &lt; 返回首页
        </button>
        <h1 style={{ fontSize: '18px', margin: 0, flex: 1, textAlign: 'center', paddingRight: '70px' }}>Bug反馈/联系我</h1>
      </header>

      <div className="page-container" style={{ flex: 1, paddingBottom: '60px' }}>
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: 'var(--primary-color)' }}>
            📬 反馈方式
          </h2>
          
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              <strong>GitHub：</strong>
              <a href="https://github.com/iChipOwO/shandong-admission-history-query" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>
                github.com/iChipOwO/shandong-admission-history-query
              </a>
            </div>
            <div style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              <strong>B站：</strong>Chiplusplus
              <br />
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>UID: 3461580184357856</span>
              <br />
              <a href="https://space.bilibili.com/3461580184357856" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>
                space.bilibili.com/3461580184357856
              </a>
            </div>
          </div>
          
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, background: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
            如果发现 Bug、数据展示异常、页面适配问题或使用体验问题，可以通过 GitHub 或 B 站反馈。这个项目不提供收费服务，也不提供专业志愿填报服务。
          </div>
        </div>
      </div>

      <DisclaimerBar />
    </div>
  );
};

export default AboutAuthor;

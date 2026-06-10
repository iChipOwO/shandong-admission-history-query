import React from 'react';
import { useNavigate } from 'react-router-dom';

const SchoolLibrary: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <header className="header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '17px' }}>学校库</h1>
        </div>
      </header>
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '60px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏫</div>
        <h2 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>学校库已升级</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', marginBottom: '24px', lineHeight: 1.6 }}>
          为了提供更丰富的维度，原“学校库”功能已合并至“学校排名”。<br/>您可以在那里继续筛选和搜索学校。
        </p>
        <button 
          className="btn" 
          onClick={() => navigate('/rankings')}
          style={{ width: '80%', maxWidth: '300px' }}
        >
          前往学校排名
        </button>
      </div>
    </div>
  );
};

export default SchoolLibrary;

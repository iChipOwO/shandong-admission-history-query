import React, { useState } from 'react';

interface DisclaimerBarProps {
  fixedToBottom?: boolean;
}

const DisclaimerBar: React.FC<DisclaimerBarProps> = ({ fixedToBottom }) => {
  const [showModal, setShowModal] = useState(false);

  const containerStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '12px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    background: fixedToBottom ? 'rgba(255,255,255,0.95)' : 'transparent',
    backdropFilter: fixedToBottom ? 'blur(4px)' : 'none',
    borderTop: fixedToBottom ? '1px solid var(--border-color)' : 'none',
    width: '100%',
    boxSizing: 'border-box',
    ...(fixedToBottom ? {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      maxWidth: '480px',
      margin: '0 auto',
      zIndex: 500,
    } : {
      marginTop: 'auto',
    })
  };

  return (
    <>
      <div style={containerStyle}>
        <span 
          style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--text-secondary)' }}
          onClick={() => setShowModal(true)}
        >
          免责声明
        </span>
        ：本工具仅提供信息查询与整理，不提供录取预测。
      </div>

      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowModal(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              width: '100%',
              maxWidth: '400px',
              lineHeight: 1.6,
              fontSize: '13px',
              color: 'var(--text-primary)',
              boxSizing: 'border-box'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', textAlign: 'center' }}>完整免责声明</h3>
            <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>本工具整理公开招生、排名和学科评估数据；</li>
              <li>仅用于信息查询与横向参考；</li>
              <li>不提供录取概率预测；</li>
              <li>不构成填报保证；</li>
              <li>排名、学科评估不参与录取判断；</li>
              <li><strong>2026专业变更核查提示：</strong>2026年可能会有新增专业、专业改名、专业合并、招生计划大幅变化、选科要求变化等情况，使用时请务必核对当年的最新官方招生章程。</li>
              <li><strong>最终填报请结合山东省教育招生考试院、高校招生章程和个人情况自行核验。</strong></li>
            </ul>
            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', marginTop: '20px' }}
              onClick={() => setShowModal(false)}
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default DisclaimerBar;

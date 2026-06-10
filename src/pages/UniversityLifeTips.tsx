import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DisclaimerBar from '../components/DisclaimerBar';

interface TipItem {
  title: string;
  content: string;
  tone: string;
  tags: string[];
}

interface TipSection {
  id: string;
  title: string;
  icon: string;
  summary: string;
  items: TipItem[];
}

interface Competition {
  name: string;
  shortName: string;
  category: string;
  suitableFor: string;
  whyWorthKnowing: string;
  officialOrSourceName: string;
  sourceUrl: string;
  sourceType: string;
  highlight?: boolean;
  highlightLabel?: string;
}

interface TipsData {
  title: string;
  subtitle: string;
  notice: string;
  sections: TipSection[];
  competitions: Competition[];
}

const TipSectionCard: React.FC<{ section: TipSection }> = ({ section }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '12px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)',
          minHeight: '52px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{section.icon}</span>
          <span>{section.title}</span>
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '8px' }}>
          {open ? '收起 ▲' : '展开 ▼'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--primary-color)', background: 'var(--card-bg-secondary)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
            💡 {section.summary}
          </div>
          {section.items.map((item, idx) => (
            <div key={idx} style={{ marginTop: idx > 0 ? '16px' : 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{item.title}</div>
              {/* Parse markdown strikethrough ~~text~~ */}
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: item.content.replace(/\n/g, '<br/>').replace(/~~(.*?)~~/g, '<del style="color: #9ca3af;">$1</del>') 
                }} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CompetitionCard: React.FC<{ comp: Competition }> = ({ comp }) => {
  return (
    <div style={{ 
      border: comp.highlight ? '1px solid #c084fc' : '1px solid var(--border-color)', 
      borderRadius: '8px', 
      padding: '12px', 
      marginBottom: '12px',
      background: comp.highlight ? '#faf5ff' : 'var(--card-bg-secondary, rgba(0,0,0,0.02))',
      position: 'relative'
    }}>
      {comp.highlight && comp.highlightLabel && (
        <div style={{ position: 'absolute', top: '-10px', right: '12px', background: '#9333ea', color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
          {comp.highlightLabel}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', marginTop: comp.highlight ? '4px' : '0' }}>
        <h4 style={{ margin: 0, fontSize: '14px', color: comp.highlight ? '#7e22ce' : 'var(--text-primary)' }}>{comp.name}</h4>
        <span style={{ fontSize: '11px', background: comp.highlight ? '#f3e8ff' : '#dbeafe', color: comp.highlight ? '#6b21a8' : '#1e40af', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap', marginLeft: '8px' }}>
          {comp.category}
        </span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>面向人群：</span>{comp.suitableFor}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>为何值得关注：</span>{comp.whyWorthKnowing}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'right' }}>
        来源：<a href={comp.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>{comp.officialOrSourceName}</a>
      </div>
    </div>
  );
};

const UniversityLifeTips: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<TipsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('data/university_life_tips.json')
      .then(res => {
        if (!res.ok) throw new Error('Fetch failed');
        return res.json();
      })
      .then(setData)
      .catch(err => {
        console.error('Failed to load university life tips:', err);
        setError(true);
      });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
        <h1 style={{ fontSize: '17px' }}>关于大学</h1>
      </header>
      
      <div className="page-container" style={{ flex: 1, paddingBottom: '24px' }}>
        {error ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚠️</div>
            无法加载内容，请检查网络后重试。
          </div>
        ) : !data ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
            正在加载提醒…
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{data.subtitle}</h2>
              <p style={{ fontSize: '13px', color: '#92400e', background: '#fffbeb', padding: '8px', borderRadius: '6px', margin: 0, border: '1px solid #fef3c7', lineHeight: 1.5 }}>
                ⚠️ {data.notice}
              </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              {data.sections.map(sec => (
                <TipSectionCard key={sec.id} section={sec} />
              ))}
            </div>

            <div className="card">
              <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🏆</span> 大学六大类高认可度竞赛简明指北
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                部分竞赛含金量极高，但不同专业适合不同赛事，切勿陷入“必须参赛”的焦虑。
              </p>
              
              {data.competitions.map((comp, idx) => (
                <CompetitionCard key={idx} comp={comp} />
              ))}
            </div>
          </>
        )}
      </div>

      <DisclaimerBar />
    </div>
  );
};

export default UniversityLifeTips;

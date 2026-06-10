import React, { useState, useRef, useEffect } from 'react';
import { useRankingSubject } from '../hooks/useRankingSubject';

interface RankingBadgeProps {
  schoolCode?: string | null;
  schoolName?: string | null;
}

const RankingBadge: React.FC<RankingBadgeProps> = ({ schoolCode, schoolName }) => {
  const { status, getDisplayRank } = useRankingSubject();
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // 数据未就绪时不显示
  if (status !== 'ready') return null;

  const resolved = getDisplayRank(schoolCode, schoolName);
  if (!resolved) return null;

  const isSecondary = resolved.sourceConfidence === 'secondary_mirror';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(v => !v);
  };

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
    >
      <span
        onClick={handleClick}
        title={`${resolved.sourceName} ${resolved.year} ${resolved.category} 第${resolved.rank}名`}
        style={{
          display: 'inline-block',
          background: '#f0fdf4',
          color: '#166534',
          border: '1px solid #bbf7d0',
          borderRadius: '4px',
          padding: '0px 5px',
          fontSize: '11px',
          fontWeight: 700,
          lineHeight: '18px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {resolved.rank}
      </span>

      {showTooltip && (
        <TooltipPortal onClose={() => setShowTooltip(false)}>
          <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, marginBottom: '4px', color: '#166534' }}>
              学校排名参考
            </div>
            <div>来源：{resolved.sourceName}</div>
            <div>年份：{resolved.year}</div>
            <div>分类：{resolved.category}</div>
            <div>排名：第 {resolved.rank} 名</div>
            {isSecondary && (
              <div style={{ color: '#b45309', marginTop: '4px', fontSize: '11px' }}>
                ⚠ 二级整理来源，数据精准度可能低于官方
              </div>
            )}
            <div style={{ color: '#6b7280', marginTop: '6px', fontSize: '11px', borderTop: '1px solid #e5e7eb', paddingTop: '4px' }}>
              排名仅作为横向参考，不参与录取判断
            </div>
          </div>
        </TooltipPortal>
      )}
    </span>
  );
};

// ─── 简单 Tooltip 浮层 ─────────────────────────────────────────────────────────
const TooltipPortal: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({
  children,
  onClose,
}) => {
  useEffect(() => {
    const close = (e: MouseEvent) => {
      onClose();
      e.stopPropagation();
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [onClose]);

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 3000,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 16px 16px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          padding: '12px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
          maxWidth: '340px',
          width: '100%',
          pointerEvents: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default RankingBadge;

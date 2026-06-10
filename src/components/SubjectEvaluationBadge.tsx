import React, { useState, useEffect } from 'react';
import { useRankingSubject } from '../hooks/useRankingSubject';
import type { MajorDirectionIndex } from '../types/majorDirection';

interface SubjectEvaluationBadgeProps {
  schoolCode?: string | null;
  schoolName?: string | null;
  majorName: string;
  majorDirectionIndex?: MajorDirectionIndex;
}

// 等级颜色
function getGradeColor(grade: string): { bg: string; color: string; border: string } {
  if (grade === 'A+') return { bg: '#fefce8', color: '#854d0e', border: '#fde047' };
  if (grade === 'A' || grade === 'A-') return { bg: '#f0fdf4', color: '#166534', border: '#86efac' };
  if (grade === 'B+' || grade === 'B' || grade === 'B-') return { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' };
  // C+, C, C-
  return { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' };
}

const SubjectEvaluationBadge: React.FC<SubjectEvaluationBadgeProps> = ({
  schoolCode,
  schoolName,
  majorName,
  majorDirectionIndex,
}) => {
  const { status, majorSubjectMap, getBestSubjectGradeForDirs } = useRankingSubject();
  const [showTooltip, setShowTooltip] = useState(false);

  // 数据未就绪时不显示
  if (status !== 'ready') return null;

  // 从 majorDirectionIndex 中查找该专业
  const dirEntry = majorDirectionIndex ? majorDirectionIndex[majorName] : undefined;

  // 规则：无 dirEntry、showUncertainMajorWarning、flags 包含指定标志 → 不显示
  if (!dirEntry) return null;
  if (dirEntry.showUncertainMajorWarning) return null;
  const flags = dirEntry.flags || [];
  if (
    flags.includes('broad_category') ||
    flags.includes('experiment_class') ||
    flags.includes('elite_unresolved_major')
  ) return null;

  const dirGroups = dirEntry.groups || [];
  if (dirGroups.length === 0) return null;

  // 找最佳学科评估
  const best = getBestSubjectGradeForDirs(schoolCode, schoolName, dirGroups, majorSubjectMap);
  if (!best) return null;

  const colors = getGradeColor(best.grade);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(v => !v);
  };

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
    >
      <span
        onClick={handleClick}
        title={`${best.subjectName} 第四轮学科评估 ${best.grade}`}
        style={{
          display: 'inline-block',
          background: colors.bg,
          color: colors.color,
          border: `1px solid ${colors.border}`,
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
        {best.grade}
      </span>

      {showTooltip && (
        <TooltipPortal onClose={() => setShowTooltip(false)}>
          <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, marginBottom: '4px', color: colors.color }}>
              学科评估参考
            </div>
            <div>评级：{best.grade}</div>
            <div>一级学科：{best.subjectName}</div>
            <div>来源：教育部第四轮学科评估</div>
            <div style={{ color: '#6b7280', marginTop: '6px', fontSize: '11px', borderTop: '1px solid #e5e7eb', paddingTop: '4px' }}>
              学科评估不等同于本科专业排名，仅反映研究生培养学科水平
            </div>
          </div>
        </TooltipPortal>
      )}
    </span>
  );
};

// ─── Tooltip 浮层 ─────────────────────────────────────────────────────────────
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

export default SubjectEvaluationBadge;

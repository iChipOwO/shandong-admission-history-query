import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRankingSubject } from '../hooks/useRankingSubject';
import { GRADE_ORDER } from '../types/ranking';
import type { SubjectEvaluationEntry } from '../types/ranking';
import { SubjectPickerModal } from '../components/SubjectPickerModal';
import DisclaimerBar from '../components/DisclaimerBar';

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

interface FlatRecord {
  schoolCode: string;
  schoolName: string;
  subject: SubjectEvaluationEntry;
}

const SubjectEvaluation: React.FC = () => {
  const navigate = useNavigate();
  const { status, subjectList } = useRankingSubject();

  const [schoolKeyword, setSchoolKeyword] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);

  // 进入页面时滚动到顶部
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // 展开所有记录为平铺列表
  const flatRecords = useMemo<FlatRecord[]>(() => {
    const result: FlatRecord[] = [];
    for (const school of subjectList) {
      for (const subject of school.subjects) {
        result.push({
          schoolCode: school.schoolCode,
          schoolName: school.schoolName,
          subject,
        });
      }
    }
    return result;
  }, [subjectList]);

  // 所有可用学科名称（用于选择器）
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const school of subjectList) {
      for (const subject of school.subjects) {
        set.add(subject.subjectName);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
  }, [subjectList]);

  // 过滤
  const filteredRecords = useMemo(() => {
    let list = flatRecords;
    if (schoolKeyword.trim()) {
      const kw = schoolKeyword.trim().toLowerCase();
      list = list.filter(r => r.schoolName.toLowerCase().includes(kw));
    }
    if (selectedSubjects.length > 0) {
      list = list.filter(r => selectedSubjects.includes(r.subject.subjectName));
    }
    if (gradeFilter.length > 0) {
      list = list.filter(r => gradeFilter.includes(r.subject.grade));
    }
    // 按等级排序
    list = [...list].sort((a, b) => {
      const ai = GRADE_ORDER.indexOf(a.subject.grade as typeof GRADE_ORDER[number]);
      const bi = GRADE_ORDER.indexOf(b.subject.grade as typeof GRADE_ORDER[number]);
      if (ai !== bi) return ai - bi;
      return a.schoolName.localeCompare(b.schoolName, 'zh');
    });
    return list;
  }, [flatRecords, schoolKeyword, selectedSubjects, gradeFilter]);

  const toggleGrade = (g: string) => {
    setGradeFilter(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}
        >←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '17px' }}>专业/学科实力</h1>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>第四轮学科评估</div>
        </div>
      </header>

      <div className="page-container" style={{ flex: 1 }}>

        {/* 说明 */}
        <div style={{
          background: '#fefce8',
          border: '1px solid #fde047',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '12px',
          color: '#78350f',
          lineHeight: 1.65,
          marginBottom: '12px',
        }}>
          📊 当前展示教育部第四轮学科评估结果，反映一级学科建设水平，<strong>不等同于本科专业排名</strong>。
        </div>

        {/* 加载中 / 错误 */}
        {status === 'loading' && (
          <div className="loading-state">📥 学科评估数据加载中，请稍候……</div>
        )}
        {status === 'error' && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', color: '#b91c1c', fontSize: '13px' }}>
            ⚠️ 学科评估数据加载失败，请刷新重试。
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* 搜索与筛选 */}
            <div className="card" style={{ marginBottom: '12px', padding: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="搜索学校名称"
                  value={schoolKeyword}
                  onChange={e => setSchoolKeyword(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="form-control"
                  onClick={() => setShowSubjectPicker(true)}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'white',
                    color: selectedSubjects.length > 0 ? 'var(--text-primary)' : '#9ca3af',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedSubjects.length > 0 ? selectedSubjects.join(', ') : '选择一级学科'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>▾</span>
                </button>
              </div>

              {/* 等级筛选 */}
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>等级筛选（可多选）：</div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {GRADE_ORDER.map(g => {
                  const selected = gradeFilter.includes(g);
                  const colors = GRADE_COLORS[g] || GRADE_COLORS['C'];
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGrade(g)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: selected ? 700 : 400,
                        cursor: 'pointer',
                        border: `1px solid ${selected ? colors.border : '#e2e8f0'}`,
                        background: selected ? colors.bg : '#f8fafc',
                        color: selected ? colors.color : '#64748b',
                        transition: 'all 0.1s',
                      }}
                    >
                      {g}
                    </button>
                  );
                })}
                {gradeFilter.length > 0 && (
                  <button
                    onClick={() => setGradeFilter([])}
                    style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b' }}
                  >
                    清除
                  </button>
                )}
              </div>
            </div>

            {/* 结果数量 */}
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              共 {filteredRecords.length} 条记录（来自 {new Set(filteredRecords.map(r => r.schoolName)).size} 所学校）
            </div>

            {/* 列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredRecords.map((record, idx) => {
                const colors = GRADE_COLORS[record.subject.grade] || GRADE_COLORS['C'];
                return (
                  <div
                    key={`${record.schoolCode}-${record.subject.subjectName}-${idx}`}
                    className="card"
                    style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                    onClick={() => navigate(`/schools/${encodeURIComponent(record.schoolCode || record.schoolName)}?schoolName=${encodeURIComponent(record.schoolName)}`)}
                  >
                    {/* 等级标签 */}
                    <span style={{
                      flexShrink: 0,
                      display: 'inline-block',
                      background: colors.bg,
                      color: colors.color,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      minWidth: '34px',
                      textAlign: 'center',
                    }}>
                      {record.subject.grade}
                    </span>
                    {/* 内容 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '2px' }}>
                        {record.schoolName}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {record.subject.subjectName}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredRecords.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px', fontSize: '14px' }}>
                  未找到符合条件的学科评估记录
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showSubjectPicker && (
        <SubjectPickerModal
          availableSubjects={availableSubjects}
          selectedSubjects={selectedSubjects}
          onConfirm={(selected) => {
            setSelectedSubjects(selected);
            setShowSubjectPicker(false);
          }}
          onClose={() => setShowSubjectPicker(false)}
        />
      )}
      <DisclaimerBar />
    </div>
  );
};

export default SubjectEvaluation;

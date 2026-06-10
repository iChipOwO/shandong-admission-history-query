import React, { useState, useMemo } from 'react';

interface SubjectPickerModalProps {
  availableSubjects: string[];
  selectedSubjects: string[];
  onConfirm: (selected: string[]) => void;
  onClose: () => void;
}

export const SubjectPickerModal: React.FC<SubjectPickerModalProps> = ({
  availableSubjects,
  selectedSubjects,
  onConfirm,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [tempSelected, setTempSelected] = useState<string[]>(selectedSubjects);

  const filteredSubjects = useMemo(() => {
    if (!search.trim()) return availableSubjects;
    const kw = search.trim().toLowerCase();
    return availableSubjects.filter(s => s.toLowerCase().includes(kw));
  }, [availableSubjects, search]);

  const toggleSubject = (s: string) => {
    setTempSelected(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.36)',
        zIndex: 2200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'white',
          borderRadius: '16px 16px 0 0',
          padding: '0 0 env(safe-area-inset-bottom, 0)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.14)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid #f1f5f9',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>选择一级学科</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
          >×</button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <input
            type="text"
            className="form-control"
            placeholder="搜索学科名称 (如: 计算机、数学)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* 已选预览 */}
        {tempSelected.length > 0 && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>已选（{tempSelected.length}）：</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {tempSelected.map(s => (
                <span key={s} style={{
                  background: 'var(--primary-color)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {s}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSubject(s); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: '14px', cursor: 'pointer' }}
                  >×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {filteredSubjects.map(s => {
              const isSelected = tempSelected.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleSubject(s)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${isSelected ? 'var(--primary-color)' : '#e2e8f0'}`,
                    background: isSelected ? '#eff6ff' : 'white',
                    color: isSelected ? 'var(--primary-color)' : 'var(--text-primary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {s}
                </button>
              );
            })}
            {filteredSubjects.length === 0 && (
              <div style={{ width: '100%', textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>
                没有找到匹配的学科
              </div>
            )}
          </div>
        </div>

        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          gap: '12px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setTempSelected([])}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: 'white',
              color: '#64748b',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            清空
          </button>
          <button
            onClick={() => onConfirm(tempSelected)}
            style={{
              flex: 2,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary-color)',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { SchoolMetadata } from '../data/schoolMetadata';

// ─── Types ─────────────────────────────────────────────────────────────────

interface HistoryEntry {
  schoolCode: string;
  schoolName: string;
  province?: string;
  city?: string;
}

interface Props {
  metadataList: SchoolMetadata[];
  metadataStatus: 'idle' | 'loading' | 'ready' | 'error';
  selectedCodes: string[];
  onConfirm: (codes: string[]) => void;
  onClose: () => void;
}

const HISTORY_KEY = 'gaokao_school_filter_history';
const MAX_HISTORY = 20;

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {}
}

function addToHistory(entry: HistoryEntry, prev: HistoryEntry[]): HistoryEntry[] {
  const filtered = prev.filter(h => h.schoolCode !== entry.schoolCode);
  return [entry, ...filtered].slice(0, MAX_HISTORY);
}

// ─── Component ──────────────────────────────────────────────────────────────

const SchoolPickerModal: React.FC<Props> = ({
  metadataList,
  metadataStatus,
  selectedCodes,
  onConfirm,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [tempSelected, setTempSelected] = useState<string[]>([...selectedCodes]);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Build a code→meta map for fast lookup
  const codeToMeta = useMemo(() => {
    const m = new Map<string, SchoolMetadata>();
    metadataList.forEach(s => { if (s.schoolCode) m.set(s.schoolCode, s); });
    return m;
  }, [metadataList]);

  // Filter by query
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return metadataList
      .filter(s => s.schoolName.toLowerCase().includes(q))
      .slice(0, 50);
  }, [query, metadataList]);

  const tempSelectedMetas = useMemo(
    () => tempSelected.map(code => codeToMeta.get(code)).filter(Boolean) as SchoolMetadata[],
    [tempSelected, codeToMeta]
  );

  const toggleSchool = (school: SchoolMetadata) => {
    const code = school.schoolCode!;
    setTempSelected(prev => {
      if (prev.includes(code)) return prev.filter(c => c !== code);
      return [...prev, code];
    });
    // Add to history
    const entry: HistoryEntry = {
      schoolCode: school.schoolCode!,
      schoolName: school.schoolName,
      province: school.province,
      city: school.city,
    };
    const newHistory = addToHistory(entry, history);
    setHistory(newHistory);
    saveHistory(newHistory);
  };

  const removeHistoryItem = (code: string) => {
    const newHistory = history.filter(h => h.schoolCode !== code);
    setHistory(newHistory);
    saveHistory(newHistory);
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const handleConfirm = () => {
    onConfirm(tempSelected);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isLoading = metadataStatus === 'loading' || metadataStatus === 'idle';
  const isError = metadataStatus === 'error';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, width: '100vw', maxWidth: '100vw',
        overflowX: 'hidden', boxSizing: 'border-box', padding: '12px',
        background: 'rgba(0,0,0,0.5)', zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={handleOverlayClick}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '720px',
          minWidth: 0,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 16px 12px',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>选择学校</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              已选 {tempSelected.length} 所
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Search input */}
        <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
          <input
            ref={inputRef}
            type="text"
            className="form-control"
            placeholder="搜索学校名称，如：电子科技大学"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '5px' }}>
            学校和城市选项来自已内置的学校元数据，用于筛选学校所在城市；留空表示不限制。
          </div>
        </div>

        {/* Loading / Error */}
        {isLoading && (
          <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
            ⏳ 学校与城市选择器正在初始化，请稍候。
          </div>
        )}
        {isError && (
          <div style={{ padding: '16px', textAlign: 'center', color: '#b91c1c', fontSize: '13px' }}>
            ⚠️ 学校与城市选择器暂不可用，但可继续使用专业和位次筛选。
          </div>
        )}

        {/* Scrollable content */}
        {!isLoading && !isError && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px' }}>

            {/* Already selected chips */}
            {tempSelected.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  已选学校
                  <button
                    onClick={() => setTempSelected([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', marginLeft: '8px' }}
                  >
                    一键清空
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tempSelectedMetas.map(s => (
                    <span
                      key={s.schoolCode}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: '#eff6ff', border: '1px solid #bfdbfe',
                        borderRadius: '16px', padding: '3px 10px',
                        fontSize: '12px', color: '#1e40af', maxWidth: '100%', minWidth: 0,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {s.schoolName}
                      </span>
                      <button
                        onClick={() => toggleSchool(s)}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Search results */}
            {query.trim() ? (
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                  搜索结果（{searchResults.length} 条）
                </div>
                {searchResults.length === 0 ? (
                  <div style={{ color: '#9ca3af', fontSize: '13px', padding: '8px 0' }}>未找到匹配学校</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {searchResults.map(s => {
                      const isSelected = s.schoolCode ? tempSelected.includes(s.schoolCode) : false;
                      return (
                        <button
                          key={s.schoolCode || s.schoolName}
                          onClick={() => s.schoolCode && toggleSchool(s)}
                          disabled={!s.schoolCode}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 10px', borderRadius: '8px', border: '1px solid',
                            borderColor: isSelected ? '#bfdbfe' : '#e5e7eb',
                            background: isSelected ? '#eff6ff' : 'white',
                            cursor: s.schoolCode ? 'pointer' : 'default',
                            textAlign: 'left', width: '100%', boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: isSelected ? '#1e40af' : '#111827', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              {s.schoolName}
                            </div>
                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              {[s.province, s.city].filter(Boolean).join(' · ')}
                              {s.schoolTypeTags && s.schoolTypeTags.length > 0 && (
                                <span style={{ marginLeft: '6px', color: '#9ca3af' }}>
                                  {s.schoolTypeTags.slice(0, 3).join(' ')}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span style={{ fontSize: '11px', color: '#3b82f6', flexShrink: 0, marginLeft: '8px' }}>✓ 已选</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* History */
              history.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>最近选择</span>
                    <button
                      onClick={clearHistory}
                      style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '11px', cursor: 'pointer' }}
                    >
                      清空历史
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {history.map(h => {
                      const isSelected = tempSelected.includes(h.schoolCode);
                      return (
                        <div
                          key={h.schoolCode}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '6px 10px', borderRadius: '8px',
                            border: '1px solid', borderColor: isSelected ? '#bfdbfe' : '#f3f4f6',
                            background: isSelected ? '#eff6ff' : '#f9fafb',
                          }}
                        >
                          <button
                            onClick={() => {
                              const meta = codeToMeta.get(h.schoolCode);
                              if (meta) toggleSchool(meta);
                              else {
                                // If metadata not in list, toggle code directly
                                setTempSelected(prev =>
                                  prev.includes(h.schoolCode)
                                    ? prev.filter(c => c !== h.schoolCode)
                                    : [...prev, h.schoolCode]
                                );
                              }
                            }}
                            style={{ background: 'none', border: 'none', flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', padding: 0 }}
                          >
                            <div style={{ fontSize: '13px', color: isSelected ? '#1e40af' : '#374151', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{h.schoolName}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              {[h.province, h.city].filter(Boolean).join(' · ')}
                            </div>
                          </button>
                          <button
                            onClick={() => removeHistoryItem(h.schoolCode)}
                            style={{ background: 'none', border: 'none', color: '#d1d5db', fontSize: '14px', cursor: 'pointer', flexShrink: 0 }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {!query.trim() && history.length === 0 && (
              <div style={{ color: '#9ca3af', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
                在上方输入框搜索学校名称
              </div>
            )}
          </div>
        )}

        {/* Footer buttons */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex', gap: '8px', flexShrink: 0,
        }}>
          <button
            onClick={() => setTempSelected([])}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            清空（{tempSelected.length}）
          </button>
          <button
            onClick={handleConfirm}
            className="btn"
            style={{ flex: 2 }}
          >
            完成，查询
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchoolPickerModal;

import React, { useState, useMemo, useEffect } from 'react';
import type { MajorDirectionGroup } from '../types/majorDirection';

interface MajorDirectionPickerModalProps {
  groups: MajorDirectionGroup[];           // 不含 broad_unspecified 的方向列表
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

const MajorDirectionPickerModal: React.FC<MajorDirectionPickerModalProps> = ({
  groups,
  selectedIds,
  onConfirm,
  onClose,
}) => {
  const [searchKw, setSearchKw] = useState('');
  const [draft, setDraft] = useState<string[]>(selectedIds);

  // 同步外部选中状态
  useEffect(() => {
    setDraft(selectedIds);
  }, [selectedIds]);

  const filtered = useMemo(() => {
    const kw = searchKw.trim().toLowerCase();
    if (!kw) return groups;
    return groups.filter(g =>
      g.name.toLowerCase().includes(kw) ||
      g.keywords?.some(k => k.includes(kw))
    );
  }, [groups, searchKw]);

  const toggleId = (id: string) => {
    setDraft(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    onConfirm(draft);
    onClose();
  };

  const handleClear = () => setDraft([]);

  const selectedGroups = groups.filter(g => draft.includes(g.id));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, width: '100vw', maxWidth: '100vw',
        overflowX: 'hidden', boxSizing: 'border-box', padding: '12px',
        background: 'rgba(0,0,0,0.45)', zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          minWidth: 0,
          maxHeight: '85vh',
          background: 'white',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── 标题栏 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px 10px',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              选择专业方向
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              可多选，留空表示全部方向
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              fontSize: '22px', color: '#9ca3af',
              cursor: 'pointer', padding: '0 4px', lineHeight: 1,
            }}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* ── 搜索框 */}
        <div style={{ padding: '10px 14px 8px', flexShrink: 0 }}>
          <input
            type="text"
            className="form-control"
            placeholder="搜索方向名称（如 计算机 / 医学 / 电子）"
            value={searchKw}
            onChange={e => setSearchKw(e.target.value)}
            style={{ fontSize: '13px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
          />
        </div>

        {/* ── 已选 chips */}
        {selectedGroups.length > 0 && (
          <div style={{
            padding: '0 14px 8px',
            flexShrink: 0,
            display: 'flex', flexWrap: 'wrap', gap: '5px',
          }}>
            {selectedGroups.map(g => (
              <span
                key={g.id}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  background: '#eff6ff', border: '1px solid #bfdbfe',
                  borderRadius: '12px', padding: '2px 8px',
                  fontSize: '12px', color: '#1e40af', maxWidth: '100%', minWidth: 0,
                }}
              >
                <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {g.name}
                </span>
                <button
                  onClick={() => toggleId(g.id)}
                  style={{
                    background: 'none', border: 'none',
                    color: '#3b82f6', cursor: 'pointer',
                    fontSize: '13px', lineHeight: 1, padding: '0 1px',
                  }}
                  aria-label={`移除 ${g.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* ── 方向列表（可滚动区域）*/}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0 14px 10px',
        }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#9ca3af', padding: '20px 0', textAlign: 'center' }}>
              没有找到匹配的方向
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', paddingTop: '4px' }}>
              {filtered.map(g => {
                const isSelected = draft.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleId(g.id)}
                    style={{
                      padding: '6px 13px',
                      borderRadius: '16px',
                      fontSize: '13px',
                      border: isSelected ? '1.5px solid var(--primary-color)' : '1px solid #e2e8f0',
                      background: isSelected ? 'var(--primary-color)' : '#f8fafc',
                      color: isSelected ? 'white' : '#334155',
                      cursor: 'pointer',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'all 0.15s ease',
                      minHeight: '34px',
                      maxWidth: '100%',
                      minWidth: 0,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {g.name}
                    {isSelected && (
                      <span style={{ marginLeft: '4px', opacity: 0.8 }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 底部操作栏 */}
        <div style={{
          padding: '10px 14px 16px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex', gap: '8px', flexShrink: 0,
        }}>
          {draft.length > 0 && (
            <button
              onClick={handleClear}
              style={{
                padding: '9px 14px', borderRadius: '8px',
                border: '1px solid #fca5a5', background: '#fff7f7',
                color: '#ef4444', fontSize: '13px', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              清空
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '9px 0', borderRadius: '8px',
              border: '1px solid #e2e8f0', background: '#f8fafc',
              color: '#64748b', fontSize: '13px', cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="btn"
            style={{ flex: 2, padding: '9px 0', borderRadius: '8px', fontSize: '13px' }}
          >
            确认
            {draft.length > 0 && <span style={{ marginLeft: '4px', opacity: 0.85 }}>（已选 {draft.length} 个）</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MajorDirectionPickerModal;

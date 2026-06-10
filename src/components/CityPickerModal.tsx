import React, { useState, useMemo } from 'react';
import type { SchoolMetadata } from '../data/schoolMetadata';

// ─── Types ─────────────────────────────────────────────────────────────────

interface CityEntry {
  province: string;
  city: string;
  key: string;
  count: number;
}

interface Props {
  metadataList: SchoolMetadata[];
  metadataStatus: 'idle' | 'loading' | 'ready' | 'error';
  selectedCities: string[];
  onConfirm: (cities: string[]) => void;
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CITY_KEY_SEPARATOR = '::';

function getCityKey(province: string, city: string): string {
  return `${province}${CITY_KEY_SEPARATOR}${city}`;
}

function buildCityList(metadataList: SchoolMetadata[]): CityEntry[] {
  const map = new Map<string, CityEntry>();
  metadataList.forEach(s => {
    if (!s.city || !s.province) return;
    const key = getCityKey(s.province, s.city);
    if (map.has(key)) {
      map.get(key)!.count++;
    } else {
      map.set(key, { province: s.province, city: s.city, key, count: 1 });
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.province !== b.province) return a.province.localeCompare(b.province);
    return b.count - a.count;
  });
}

function formatCityLabel(key: string, cityMap: Map<string, CityEntry>): string {
  const entry = cityMap.get(key);
  if (entry) return `${entry.province} · ${entry.city}`;
  if (key.includes(CITY_KEY_SEPARATOR)) return key.replace(CITY_KEY_SEPARATOR, ' · ');
  return key;
}

function normalizeSelectedCityKeys(selected: string[], allCities: CityEntry[]): string[] {
  const cityToKeys = new Map<string, string[]>();
  allCities.forEach(entry => {
    const keys = cityToKeys.get(entry.city) || [];
    keys.push(entry.key);
    cityToKeys.set(entry.city, keys);
  });

  return Array.from(new Set(selected.map(value => {
    if (value.includes(CITY_KEY_SEPARATOR)) return value;
    const keys = cityToKeys.get(value);
    return keys?.length === 1 ? keys[0] : value;
  })));
}

// ─── Component ──────────────────────────────────────────────────────────────

const CityPickerModal: React.FC<Props> = ({
  metadataList,
  metadataStatus,
  selectedCities,
  onConfirm,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  // Build city list from metadata
  const allCities = useMemo(() => buildCityList(metadataList), [metadataList]);
  const cityMap = useMemo(() => new Map(allCities.map(city => [city.key, city])), [allCities]);
  const [tempSelected, setTempSelected] = useState<string[]>(() => normalizeSelectedCityKeys(selectedCities, allCities));

  const isLoading = metadataStatus === 'loading' || metadataStatus === 'idle';
  const isError = metadataStatus === 'error';

  // Filter by query
  const filteredCities = useMemo(() => {
    if (!query.trim()) return allCities;
    const q = query.toLowerCase();
    return allCities.filter(
      c => c.city.toLowerCase().includes(q) || c.province.toLowerCase().includes(q)
    );
  }, [query, allCities]);

  // Group by province
  const grouped = useMemo(() => {
    const g = new Map<string, CityEntry[]>();
    filteredCities.forEach(c => {
      if (!g.has(c.province)) g.set(c.province, []);
      g.get(c.province)!.push(c);
    });
    return Array.from(g.entries()); // [province, cities[]]
  }, [filteredCities]);

  const toggleCity = (cityKey: string) => {
    setTempSelected(prev =>
      prev.includes(cityKey) ? prev.filter(c => c !== cityKey) : [...prev, cityKey]
    );
  };

  const handleConfirm = () => {
    onConfirm(tempSelected);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

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
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>选择城市</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              已选 {tempSelected.length} 个
            </span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: '22px', color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Search input */}
        <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
          <input
            type="text"
            className="form-control"
            placeholder="搜索城市或省份名称"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '5px' }}>
            城市来自已内置的学校元数据，表示学校所在城市；留空表示不限制。
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

        {/* Selected chips */}
        {!isLoading && !isError && tempSelected.length > 0 && (
          <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>已选城市</span>
              <button
                onClick={() => setTempSelected([])}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}
              >
                一键清空
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {tempSelected.map(cityKey => (
                <span
                  key={cityKey}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: '16px', padding: '3px 10px',
                    fontSize: '12px', color: '#1e40af', maxWidth: '100%', minWidth: 0,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {formatCityLabel(cityKey, cityMap)}
                  </span>
                  <button
                    onClick={() => toggleCity(cityKey)}
                    style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Province-grouped city list */}
        {!isLoading && !isError && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px' }}>
            {grouped.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
                {query.trim() ? '未找到匹配城市' : '暂无城市数据'}
              </div>
            ) : (
              grouped.map(([province, cities]) => (
                <div key={province} style={{ marginBottom: '12px' }}>
                  {/* Province header */}
                  <div style={{
                    fontSize: '12px', fontWeight: 600, color: '#6b7280',
                    padding: '4px 0', borderBottom: '1px solid #f3f4f6', marginBottom: '6px',
                  }}>
                    {province}
                  </div>
                  {/* City chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {cities.map(c => {
                      const isSelected = tempSelected.includes(c.key);
                      return (
                        <button
                          key={c.key}
                          onClick={() => toggleCity(c.key)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '16px',
                            fontSize: '13px',
                            border: '1px solid',
                            borderColor: isSelected ? '#bfdbfe' : '#e5e7eb',
                            background: isSelected ? '#eff6ff' : 'white',
                            color: isSelected ? '#1e40af' : '#374151',
                            cursor: 'pointer',
                            alignItems: 'center',
                            gap: '4px',
                            maxWidth: '100%',
                            minWidth: 0,
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                          }}
                        >
                          {isSelected && <span style={{ color: '#3b82f6', fontSize: '11px' }}>✓</span>}
                          {c.city}
                          <span style={{ fontSize: '10px', color: '#9ca3af' }}>{c.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
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

export default CityPickerModal;

import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { GroupedAdmission } from '../utils/admissionGrouping';

interface AdmissionTrendChartProps {
  group: GroupedAdmission;
  userRank: number | null | undefined;
}

const AdmissionTrendChart: React.FC<AdmissionTrendChartProps> = ({ group, userRank }) => {
  const rank2023 = group.records[2023]?.minRank || null;
  const rank2024 = group.records[2024]?.minRank || null;
  const rank2025 = group.records[2025]?.minRank || null;

  const validRanks = [rank2023, rank2024, rank2025].filter(r => r !== null) as number[];
  const hasData = validRanks.length > 0;
  
  // Calculate padding and dynamic range
  let yMin = 1;
  let yMax = 999999;
  let inverse = true;

  if (validRanks.length >= 2) {
    const minRank = Math.min(...validRanks);
    const maxRank = Math.max(...validRanks);
    const span = maxRank - minRank;
    const padding = Math.max(Math.ceil(span * 0.15), Math.ceil(maxRank * 0.03), 100);
    yMin = Math.max(1, minRank - padding);
    yMax = maxRank + padding;
  } else if (validRanks.length === 1) {
    const r = validRanks[0];
    const padding = Math.max(Math.ceil(r * 0.1), 500);
    yMin = Math.max(1, r - padding);
    yMax = r + padding;
  }

  const option = {
    title: {
      text: '最低位次趋势',
      textStyle: { fontSize: 12, color: '#6b7280', fontWeight: 'normal' },
      left: 'center',
      top: 0
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0];
        if (data.value === null) return `${data.name}<br/>无数据`;
        return `${data.name}<br/>最低位次: ${data.value}`;
      }
    },
    grid: { left: '15%', right: '5%', bottom: '10%', top: '30px' },
    xAxis: {
      type: 'category',
      data: ['2023', '2024', '2025'],
      axisTick: { alignWithLabel: true }
    },
    yAxis: {
      type: 'value',
      inverse: inverse,
      min: yMin,
      max: yMax,
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 10000) return (value / 10000).toFixed(1) + '万';
          return value;
        }
      }
    },
    series: [
      {
        name: '最低位次',
        data: [rank2023, rank2024, rank2025],
        type: 'line',
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: '#3b82f6' },
        lineStyle: { width: 3 },
        connectNulls: false,
        markLine: userRank ? {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#ef4444', type: 'dashed' },
          label: { formatter: '我的位次', position: 'insideStartTop' },
          data: [{ yAxis: userRank }]
        } : undefined
      }
    ]
  };

  const isValidPositiveNumber = (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed !== '' && trimmed !== '--' && Number.isFinite(Number(trimmed)) && Number(trimmed) > 0;
    }
    return false;
  };

  const isValidPlanCount = (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed !== '' && trimmed !== '--' && Number.isFinite(Number(trimmed)) && Number(trimmed) >= 0;
    }
    return false;
  };

  const renderYearData = (year: number) => {
    const record = group.records[year];
    if (!record) return <div style={{ color: '#9ca3af' }}>暂无数据 / 未开始招生</div>;
    const hasRank = isValidPositiveNumber(record.minRank);
    const hasPlan = isValidPlanCount(record.planCount);
    if (!hasRank && !hasPlan) {
      return <div style={{ color: '#9ca3af' }}>暂无数据 / 未开始招生</div>;
    }
    return (
      <div>
        <div style={{ fontWeight: 500 }}>
          {hasRank && typeof record.minRank === 'number' ? `${record.minRank.toLocaleString()}位` : '--位'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          计划: {hasPlan ? record.planCount : '--'}
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '16px', background: '#f8fafc', padding: '16px 12px', borderRadius: '8px' }}>
      <div style={{ textAlign: 'center', color: '#3b82f6', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
        最低位次
      </div>

      {!hasData ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>数据不足，无法展示趋势图</div>
      ) : (
        <>
          <ReactECharts option={option} style={{ height: '240px' }} />
          {validRanks.length === 1 && (
            <div style={{
              textAlign: 'center',
              fontSize: '12px',
              color: '#d97706',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              padding: '6px 12px',
              marginTop: '6px',
            }}>
              ⚠️ 仅有 1 年数据，数据不足，无法判断趋势
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '14px' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>2023</div>
          {renderYearData(2023)}
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>2024</div>
          {renderYearData(2024)}
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '14px' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>2025</div>
          {renderYearData(2025)}
        </div>
      </div>
    </div>
  );
};

export default AdmissionTrendChart;

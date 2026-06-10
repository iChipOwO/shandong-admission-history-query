import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmissionData } from '../context/AdmissionDataContext';
import { useSchoolMetadata } from '../hooks/useSchoolMetadata';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useDataCacheStatus } from '../hooks/useDataCacheStatus';
import { admissionRepository } from '../services/admissionRepository';
import DisclaimerBar from '../components/DisclaimerBar';

const QUERY_FILTER_STATE_KEY = 'gaokao_query_filter_state';
const SCHOOL_FILTER_HISTORY_KEY = 'gaokao_school_filter_history';

interface DataManifestSource {
  name: string;
  description: string;
}

interface DataManifest {
  appDataVersion: string;
  province: string;
  years: number[];
  batch: string;
  admissionDataFile: string;
  schoolMetadataFile: string;
  scope: {
    provinces: string[];
    years: number[];
    batches: string[];
    excludes: string[];
  };
  sources: DataManifestSource[];
  notes: string[];
  updatedAt: string;
}

const DataStatus: React.FC = () => {
  const navigate = useNavigate();
  const { status: admissionStatus } = useAdmissionData();
  const { status: metadataStatus, metadataList } = useSchoolMetadata();
  const onlineStatus = useOnlineStatus();
  const dataCacheStatus = useDataCacheStatus();
  const [dataManifest, setDataManifest] = useState<DataManifest | null>(null);
  const [swRegistered, setSwRegistered] = useState<boolean | null>(null);
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    // Load data manifest
    fetch('data/data_manifest.json')
      .then(r => r.json())
      .then(setDataManifest)
      .catch(() => {});

    // Check SW registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        setSwRegistered(!!reg);
      });
    } else {
      setSwRegistered(false);
    }

    // Count reports
    try {
      const raw = localStorage.getItem('gaokao_reports');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setReportCount(parsed.length);
      }
    } catch {
      // ignore
    }
  }, []);

  const admissionRecordCount = admissionStatus === 'ready'
    ? admissionRepository.getAllRecords().length
    : null;

  const StatusBadge: React.FC<{ ok: boolean; label?: string }> = ({ ok, label }) => (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '99px',
      fontSize: '12px',
      fontWeight: 600,
      background: ok ? '#d1fae5' : '#fee2e2',
      color: ok ? '#065f46' : '#991b1b',
      marginLeft: '8px',
    }}>
      {label ?? (ok ? '✓ 正常' : '✗ 未就绪')}
    </span>
  );

  const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{
      background: 'var(--surface-color)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      border: '1px solid var(--border-color)',
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600 }}>{title}</h3>
      {children}
    </div>
  );

  const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '6px 0', borderBottom: '1px solid var(--border-color)',
      fontSize: '14px', gap: '12px',
    }}>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: 'right', fontWeight: 500, minWidth: 0, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );

  const ResetItem: React.FC<{
    label: string;
    desc: string;
    danger?: boolean;
    confirmMsg?: string;
    onConfirm: () => string;
  }> = ({ label, desc, danger = false, confirmMsg, onConfirm }) => {
    const [status, setStatus] = React.useState<string | null>(null);
    const handleClick = () => {
      const msg = confirmMsg ?? `确定要执行「${label}」吗？`;
      if (!window.confirm(msg)) return;
      const result = onConfirm();
      setStatus(result);
      setTimeout(() => setStatus(null), 4000);
    };
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: '12px', padding: '10px 12px', borderRadius: '8px',
        background: danger ? '#fff5f5' : '#f8fafc',
        border: `1px solid ${danger ? '#fca5a5' : 'var(--border-color)'}`,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: danger ? '#b91c1c' : 'var(--text-primary)', marginBottom: '2px' }}>{label}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
          {status && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#059669', fontWeight: 500 }}>✓ {status}</div>
          )}
        </div>
        <button
          onClick={handleClick}
          style={{
            flexShrink: 0, fontSize: '12px', padding: '5px 12px',
            background: danger ? '#fef2f2' : '#eff6ff',
            border: `1px solid ${danger ? '#fca5a5' : '#bfdbfe'}`,
            borderRadius: '6px',
            color: danger ? '#b91c1c' : '#1e40af',
            cursor: 'pointer', fontWeight: 500,
          }}
        >
          执行
        </button>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: 'none', color: '#fff',
              fontSize: '20px', cursor: 'pointer', padding: '0 4px',
            }}
            aria-label="返回"
          >
            ←
          </button>
          <h1 style={{ margin: 0 }}>数据状态 / 离线说明</h1>
        </div>
      </header>

      <div className="page-container" style={{ flex: 1 }}>

        {/* ── Online status banner ─────────────────────────── */}
        <div style={{
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          background: onlineStatus === 'online' ? '#d1fae5' : '#fef3c7',
          color: onlineStatus === 'online' ? '#065f46' : '#92400e',
          border: `1px solid ${onlineStatus === 'online' ? '#6ee7b7' : '#fcd34d'}`,
        }}>
          {onlineStatus === 'online'
            ? '🟢 当前在线，本地数据可正常初始化。'
            : dataCacheStatus.admissions && dataCacheStatus.schoolMetadata
              ? '🟡 当前离线，已使用本地缓存数据。'
              : '🟠 当前离线，可能无法首次加载录取库。请联网打开一次完成初始化。'
          }
        </div>

        {/* ── Admission data status ────────────────────────── */}
        <SectionCard title="📊 录取库状态">
          <Row label="加载状态" value={
            <>
              {admissionStatus === 'idle' && '等待初始化'}
              {admissionStatus === 'loading' && '正在加载…'}
              {admissionStatus === 'ready' && <><span style={{ color: '#059669' }}>已就绪</span><StatusBadge ok={true} /></>}
              {admissionStatus === 'error' && <><span style={{ color: '#b91c1c' }}>加载失败</span><StatusBadge ok={false} /></>}
            </>
          } />
          <Row label="数据文件" value={<code style={{ fontSize: '12px' }}>data/admissions_shandong_2023_2025.json</code>} />
          <Row label="记录数量" value={admissionRecordCount !== null ? `${admissionRecordCount.toLocaleString()} 条` : '—'} />
          <Row label="数据年份" value={dataManifest ? dataManifest.years.join('、') + ' 年' : '—'} />
          <Row label="批次" value={dataManifest?.batch ?? '—'} />
          <Row label="数据版本" value={<code style={{ fontSize: '12px' }}>{dataManifest?.appDataVersion ?? '—'}</code>} />
        </SectionCard>

        {/* ── School metadata status ───────────────────────── */}
        <SectionCard title="🏫 学校信息库状态">
          <Row label="加载状态" value={
            <>
              {metadataStatus === 'idle' && '等待初始化'}
              {metadataStatus === 'loading' && '正在加载…'}
              {metadataStatus === 'ready' && <><span style={{ color: '#059669' }}>已就绪</span><StatusBadge ok={true} /></>}
              {metadataStatus === 'error' && <><span style={{ color: '#b91c1c' }}>加载失败</span><StatusBadge ok={false} /></>}
            </>
          } />
          <Row label="数据文件" value={<code style={{ fontSize: '12px' }}>data/school_metadata.json</code>} />
          <Row label="学校数量" value={metadataStatus === 'ready' ? `${metadataList.length} 所` : '—'} />
          <Row label="标签可用" value={metadataStatus === 'ready' ? <StatusBadge ok={true} /> : '—'} />
        </SectionCard>

        {/* ── Offline / SW status ──────────────────────────── */}
        <SectionCard title="📶 离线缓存状态">
          <Row label="Service Worker" value={
            swRegistered === null ? '检查中…'
              : swRegistered ? <StatusBadge ok={true} label="已注册" />
              : <StatusBadge ok={false} label="不支持/未注册" />
          } />
          <Row label="网络状态" value={onlineStatus === 'online' ? '🟢 在线' : '🔴 离线'} />
          <Row label="录取数据缓存" value={
            !dataCacheStatus.checked ? '检查中…'
              : dataCacheStatus.admissions ? <StatusBadge ok={true} label="已缓存" />
              : <StatusBadge ok={false} label="未缓存" />
          } />
          <Row label="学校数据缓存" value={
            !dataCacheStatus.checked ? '检查中…'
              : dataCacheStatus.schoolMetadata ? <StatusBadge ok={true} label="已缓存" />
              : <StatusBadge ok={false} label="未缓存" />
          } />
          <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            首次联网打开后，录取库将自动缓存到本地。完成后离线也可查询。
          </div>
        </SectionCard>

        {/* ── Report backup reminder ───────────────────────── */}
        <SectionCard title="💾 报告备份提醒">
          <Row label="本机报告数" value={`${reportCount} 份`} />
          <Row label="存储位置" value="本机浏览器 localStorage" />
          <Row label="同步/上传" value="不上传报告、收藏或用户画像数据" />
          <div style={{
            marginTop: '12px', padding: '10px 12px',
            background: '#fef3c7', borderRadius: '8px',
            border: '1px solid #fcd34d', fontSize: '13px',
            lineHeight: 1.6, color: '#92400e',
          }}>
            ⚠️ 清理浏览器数据（清除缓存/Cookie）可能导致<strong>报告丢失</strong>。<br />
            建议前往「我的报告」定期导出 JSON 备份或 Markdown 文本。
          </div>
          <button
            onClick={() => navigate('/reports')}
            className="btn"
            style={{ marginTop: '12px', width: '100%' }}
          >
            前往报告管理
          </button>
        </SectionCard>

        {/* ── Data scope explanation ───────────────────────── */}
        <SectionCard title="📋 数据范围说明">
          <div style={{ fontSize: '14px', lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 8px', fontWeight: 500 }}>当前数据包含：</p>
            <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
              <li>省份：<strong>山东</strong></li>
              <li>年份：<strong>2023、2024、2025 年</strong></li>
              <li>批次：<strong>普通类常规批第 1 次志愿</strong>投档数据</li>
            </ul>
            <p style={{ margin: '0 0 8px', fontWeight: 500 }}>不包含：</p>
            <ul style={{ margin: '0 0 12px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
              <li>艺术类、体育类、春季高考</li>
              <li>普通类第 2 次、第 3 次志愿</li>
              <li>提前批、特殊类型批</li>
              <li>其他省份数据</li>
            </ul>
            <p style={{ margin: '0 0 8px', fontWeight: 500 }}>使用提示：</p>
            <ul style={{ margin: '0', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
              {(dataManifest?.notes ?? [
                '分数不是核心参考，位次更重要',
                '请结合当年最新招生章程核查变化',
              ]).map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        </SectionCard>

        {/* ── Data sources ────────────────────────────────── */}
        {dataManifest?.sources && (
          <SectionCard title="📌 数据来源">
            {dataManifest.sources.map((src, i) => (
              <div key={i} style={{ marginBottom: '10px', fontSize: '14px' }}>
                <div style={{ fontWeight: 600 }}>{src.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{src.description}</div>
              </div>
            ))}
          </SectionCard>
        )}

        {/* ── Local test data management ────────────────────────── */}
        <SectionCard title="🗑️ 本地数据管理（测试 / 重置）">
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6 }}>
            以下操作只影响本机浏览器中的个人设置、收藏和报告，<strong>不会修改内置录取数据</strong>，不影响 PWA 安装和离线缓存。
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Reset guide */}
            <ResetItem
              label="重置首次使用引导"
              desc="清除 gaokao_first_guide_dismissed，下次回到首页将重新显示引导。"
              danger={false}
              onConfirm={() => {
                localStorage.removeItem('gaokao_first_guide_dismissed');
                return '首次使用引导将在下次回到首页时显示。';
              }}
            />
            {/* Clear query filters */}
            <ResetItem
              label="清空查询筛选状态"
              desc="清除 gaokao_query_filter_state 和 gaokao_school_filter_history（学校/城市筛选与学校选择历史）。"
              danger={false}
              onConfirm={() => {
                localStorage.removeItem(QUERY_FILTER_STATE_KEY);
                localStorage.removeItem(SCHOOL_FILTER_HISTORY_KEY);
                return '查询筛选状态和学校选择历史已清空。';
              }}
            />
            {/* Clear profile */}
            <ResetItem
              label="清空用户画像"
              desc="清除 gaokao_user_profile（位次、分数、选科等）。"
              danger
              onConfirm={() => {
                localStorage.removeItem('gaokao_user_profile');
                return '用户画像已清空。';
              }}
            />
            {/* Clear favorites */}
            <ResetItem
              label="清空收藏"
              desc="清除 gaokao_favorites（志愿收藏、学校收藏、城市收藏）。"
              danger
              onConfirm={() => {
                localStorage.removeItem('gaokao_favorites');
                return '收藏已全部清空。';
              }}
            />
            {/* Clear reports */}
            <ResetItem
              label="清空报告与快照"
              desc="⚠️ 清除 gaokao_reports 和 gaokao_reports_snapshots。建议先导出 JSON 备份再操作！"
              danger
              onConfirm={() => {
                localStorage.removeItem('gaokao_reports');
                localStorage.removeItem('gaokao_reports_snapshots');
                localStorage.removeItem('gaokao_active_report_id');
                return '报告和快照已全部清空。';
              }}
            />
            {/* Clear all */}
            <ResetItem
              label="🚨 一键清空全部本地测试数据"
              desc="清除引导状态、用户画像、收藏、报告与快照。不清除 Service Worker 缓存，不影响离线数据和 PWA。"
              danger
              confirmMsg="确定要一键清空所有本地个人数据（画像、收藏、报告、引导状态）吗？此操作不可恢复，建议先导出 JSON 备份。"
              onConfirm={() => {
                localStorage.removeItem('gaokao_first_guide_dismissed');
                localStorage.removeItem('gaokao_user_profile');
                localStorage.removeItem('gaokao_favorites');
                localStorage.removeItem('gaokao_reports');
                localStorage.removeItem('gaokao_reports_snapshots');
                localStorage.removeItem('gaokao_active_report_id');
                localStorage.removeItem(QUERY_FILTER_STATE_KEY);
                localStorage.removeItem(SCHOOL_FILTER_HISTORY_KEY);
                return '已清空所有本地个人数据。内置录取数据和离线缓存不受影响。';
              }}
            />
          </div>
        </SectionCard>

      </div>
      <DisclaimerBar />
    </div>
  );
};

export default DataStatus;

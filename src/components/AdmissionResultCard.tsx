import React from 'react';
import type { GroupedAdmission } from '../utils/admissionGrouping';
import { getTrendLabel, getReferenceLabel } from '../utils/admissionAnalysis';
import { useSchoolMetadata } from '../hooks/useSchoolMetadata';
import { saveSnapshot } from '../utils/reportSnapshot';
import type { AdmissionReport, ReportItem } from '../types/report';
import type { MajorDirectionIndex } from '../types/majorDirection';
import RankingBadge from './RankingBadge';
import SubjectEvaluationBadge from './SubjectEvaluationBadge';
import ReportSelectorModal from './ReportSelectorModal';

const AdmissionTrendChart = React.lazy(() => import('./AdmissionTrendChart'));

const REPORTS_KEY = 'gaokao_reports';
const ACTIVE_REPORT_KEY = 'gaokao_active_report_id';

interface AdmissionResultCardProps {
  group: GroupedAdmission;
  userRank: number | null | undefined;
  isFav: boolean;
  onToggleFav: (group: GroupedAdmission) => void;
  showDetails?: boolean;
  hideDetailsToggle?: boolean;
  /** If provided, clicking + will add to this report; otherwise reads from localStorage */
  activeReportId?: string | null;
  onReportChange?: () => void;
  /** 专业方向索引，用于展示标签 */
  majorDirectionIndex?: MajorDirectionIndex;
}

const AdmissionResultCard: React.FC<AdmissionResultCardProps> = ({
  group,
  userRank,
  isFav,
  onToggleFav,
  showDetails = false,
  hideDetailsToggle = false,
  activeReportId: propActiveReportId,
  onReportChange,
  majorDirectionIndex,
}) => {
  const [showTrend, setShowTrend] = React.useState(showDetails);
  const [showSpecialPopover, setShowSpecialPopover] = React.useState(false);
  const [showTipsModal, setShowTipsModal] = React.useState(false);
  const [showDirectionWarning, setShowDirectionWarning] = React.useState(false);
  const [addMsg, setAddMsg] = React.useState<string | null>(null);
  const [showMultiReportAdd, setShowMultiReportAdd] = React.useState(false);
  const { getSchoolMetadata, status } = useSchoolMetadata();

  const schoolMeta = getSchoolMetadata(group.schoolCode, group.schoolName);
  const city = schoolMeta?.city || '';
  const province = schoolMeta?.province || '';
  const cityConfirmed = schoolMeta?.cityConfirmed;
  const tags = schoolMeta?.schoolTypeTags || [];

  const latestMinRank = group.latestRecord?.minRank || null;

  const rank2023 = group.records[2023]?.minRank || null;
  const rank2024 = group.records[2024]?.minRank || null;
  const rank2025 = group.records[2025]?.minRank || null;

  const trend = getTrendLabel([rank2025, rank2024, rank2023]);
  const reference = getReferenceLabel(userRank, latestMinRank);
  const normalizedTrend = String(trend).trim().toLowerCase();
  const shouldShowTrendBadge = !['数据不足', 'insufficient', 'unknown', 'not_enough_data'].includes(normalizedTrend);

  const majorNameLower = (group.majorName + ' ' + (schoolMeta?.note || '')).toLowerCase();
  const specialKeywords = ['试验班', '实验班', '大类', '工科试验班', '理科试验班', '医学试验班', '拔尖', '中外合作', '合作办学', '联合培养', '校区', '威海', '深圳', '苏州', '珠海', '高收费'];
  const showSpecialTip = specialKeywords.some(kw => majorNameLower.includes(kw));

  // ── 专业方向标签
  const dirEntry = majorDirectionIndex ? majorDirectionIndex[group.majorName] : undefined;
  const dirFlags = dirEntry?.flags || [];
  const showUncertainWarning = dirEntry?.showUncertainMajorWarning || false;

  const getTrendColor = (t: string) => {
    if (t === '升温') return '#ef4444';
    if (t === '降温') return '#10b981';
    if (t === '波动较大') return '#f59e0b';
    return '#6b7280';
  };

  const getRefColor = (r: string) => {
    if (r === '差距较大') return '#7c3aed';
    if (r === '偏冲') return '#ef4444';
    if (r === '接近') return '#f59e0b';
    if (r === '相对稳') return '#10b981';
    return '#6b7280';
  };

  const fmtRank = (r: number | null) => r ? r.toLocaleString() : null;

  // Rank diff for 2025 only: positive means user is ahead (better), negative means behind
  const getRankDiff2025 = () => {
    if (!userRank || !rank2025) return null;
    const diff = rank2025 - userRank; // positive = user is ahead (rank2025 > userRank means user has smaller/better rank)
    return diff;
  };
  const rankDiff2025 = getRankDiff2025();

  React.useEffect(() => {
    if (!showSpecialPopover) return;
    const closePopover = () => setShowSpecialPopover(false);
    document.addEventListener('click', closePopover);
    return () => document.removeEventListener('click', closePopover);
  }, [showSpecialPopover]);

  React.useEffect(() => {
    if (!showDirectionWarning) return;
    const close = () => setShowDirectionWarning(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showDirectionWarning]);

  const handleSpecialTipClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setShowSpecialPopover(v => !v);
  };

  // Add to report logic
  const handleAddToReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const raw = localStorage.getItem(REPORTS_KEY);
      let reports: AdmissionReport[] = raw ? JSON.parse(raw) : [];

      // Determine active report ID
      let activeId = propActiveReportId ?? localStorage.getItem(ACTIVE_REPORT_KEY);

      // Find or create main report
      if (!activeId || !reports.find(r => r.id === activeId)) {
        let mainReport = reports.find(r => r.name === 'main');
        if (!mainReport) {
          mainReport = {
            id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'main',
            items: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          reports = [...reports, mainReport];
        }
        activeId = mainReport.id;
        localStorage.setItem(ACTIVE_REPORT_KEY, activeId);
      }

      const reportIdx = reports.findIndex(r => r.id === activeId);
      if (reportIdx === -1) return;

      const report = reports[reportIdx];
      const itemId = `${group.schoolCode}_${group.majorCode}`;

      if (report.items.some(item => item.id === itemId)) {
        setAddMsg('该候选项已在当前报告中。');
        setTimeout(() => setAddMsg(null), 2500);
        return;
      }

      const newItem: ReportItem = {
        id: itemId,
        schoolCode: group.schoolCode,
        schoolName: group.schoolName,
        majorCode: group.majorCode,
        majorName: group.majorName,
        order: report.items.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveSnapshot(reports, '添加报告项');
      const updatedReports = [...reports];
      updatedReports[reportIdx] = {
        ...report,
        items: [...report.items, newItem],
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(REPORTS_KEY, JSON.stringify(updatedReports));
      setAddMsg(`已加入「${report.name}」报告。`);
      setTimeout(() => setAddMsg(null), 2500);
      onReportChange?.();
    } catch (err) {
      console.error(err);
      setAddMsg('加入失败，请重试。');
      setTimeout(() => setAddMsg(null), 2500);
    }
  };

  return (
    <div className="card" style={{ padding: '12px 14px', border: isFav ? '2px solid #f59e0b' : '1px solid var(--border-color)', position: 'relative' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: school name */}
          <h3 style={{ fontSize: '15px', color: 'var(--primary-color)', fontWeight: 600, marginBottom: '4px', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            {group.schoolName}
            <RankingBadge schoolCode={group.schoolCode} schoolName={group.schoolName} />
          </h3>

          {/* Row 2: major name */}
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'flex-start', gap: '4px', lineHeight: 1.35 }}>
            {showSpecialTip && (
              <button
                onClick={handleSpecialTipClick}
                style={{
                  width: '20px',
                  height: '20px',
                  background: '#f59e0b',
                  border: '2px solid #d97706',
                  borderRadius: '50%',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 800,
                  lineHeight: 1,
                  padding: 0,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 4px rgba(245,158,11,0.45)',
                }}
                title="查看特殊招生提示"
                aria-label="查看特殊招生提示"
              >
                !
              </button>
            )}
            <span style={{ minWidth: 0 }}>{group.majorName}</span>
            <SubjectEvaluationBadge
              schoolCode={group.schoolCode}
              schoolName={group.schoolName}
              majorName={group.majorName}
              majorDirectionIndex={majorDirectionIndex}
            />
          </div>

          {/* Row 3: city + tags */}
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap', lineHeight: 1.5, alignItems: 'center' }}>
            {status === 'loading' || status === 'idle' ? (
              <span>学校信息加载中…</span>
            ) : status === 'error' ? (
              <span>学校信息加载失败</span>
            ) : (
              <>
                {(province || city) && (
                  <span style={{ color: '#4b5563' }}>
                    {province}{province !== city && city ? `｜${city}` : ''}
                    {cityConfirmed === false ? <span style={{ color: '#9ca3af' }}> (待确认)</span> : ''}
                  </span>
                )}
                {tags.length > 0 ? (
                  tags.map((t: string) => (
                    <span key={t} style={{
                      background: '#eff6ff', color: '#1d4ed8',
                      padding: '1px 6px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                    }}>
                      {t}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#9ca3af', fontSize: '11px' }}>标签待完善</span>
                )}
              </>
            )}
          </div>

          {/* Row 4: rank data — clickable to toggle trend */}
          <div
            onClick={() => !hideDetailsToggle && setShowTrend(v => !v)}
            style={{
              background: '#f8fafc', borderRadius: '6px', padding: '7px 10px',
              marginBottom: '6px', fontSize: '12px', lineHeight: 1.7,
              cursor: hideDetailsToggle ? 'default' : 'pointer',
              border: '1px solid #e5e7eb',
              userSelect: 'none',
            }}
            title={hideDetailsToggle ? '' : showTrend ? '点击收起趋势图' : '点击查看趋势图 📈'}
          >
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline' }}>
              {rank2023 !== null && (
                <span>2023: <strong>{fmtRank(rank2023)}</strong></span>
              )}
              {rank2024 !== null && (
                <span>2024: <strong>{fmtRank(rank2024)}</strong></span>
              )}
              {rank2025 !== null ? (
                <span>
                  2025: <strong>{fmtRank(rank2025)}</strong>
                  {rankDiff2025 !== null && (
                    <span style={{
                      marginLeft: '4px', fontSize: '11px', fontWeight: 700,
                      color: rankDiff2025 > 0 ? '#059669' : '#dc2626',
                    }}>
                      ({rankDiff2025 > 0 ? `+${rankDiff2025.toLocaleString()}` : rankDiff2025.toLocaleString()})
                    </span>
                  )}
                </span>
              ) : null}
              {rank2023 === null && rank2024 === null && rank2025 === null && (
                <span style={{ color: 'var(--text-secondary)' }} onClick={(e) => { e.stopPropagation(); setShowTipsModal(true); }}>
                  数据不全 <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>(?)</span>
                </span>
              )}
              {!hideDetailsToggle && (
                <span style={{ color: '#9ca3af', fontSize: '11px', marginLeft: 'auto' }}>
                  {showTrend ? '收起 ▲' : '📈'}
                </span>
              )}
            </div>
          </div>

          {/* Row 5: badges */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {shouldShowTrendBadge && (
              <span style={{ background: `${getTrendColor(trend)}18`, color: getTrendColor(trend), padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                {trend}
              </span>
            )}
            <span style={{ background: `${getRefColor(reference)}18`, color: getRefColor(reference), padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
              {reference}
            </span>
            {shouldShowTrendBadge && trend === '升温' && (
              <span style={{ fontSize: '11px', color: '#b91c1c' }}>近年门槛升温，请谨慎</span>
            )}
          </div>

          {/* Row 6: 专业方向标签 */}
          {dirEntry && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
              {dirFlags.includes('cooperation') && (
                <span style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                  中外合作
                </span>
              )}
              {dirFlags.includes('campus') && (
                <span style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                  校区
                </span>
              )}
              {(dirFlags.includes('broad_category') || dirFlags.includes('experiment_class')) && (
                <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                  大类/试验班
                </span>
              )}
              {dirFlags.includes('cross_discipline') && (
                <span style={{ background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                  交叉学科
                </span>
              )}
              {dirFlags.includes('high_fee') && (
                <span style={{ background: '#fff7ed', color: '#92400e', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                  高收费提示
                </span>
              )}
              {dirFlags.includes('elite_unresolved_major') && (
                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                  重点院校特殊项目
                </span>
              )}
              {showUncertainWarning && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDirectionWarning(v => !v); }}
                  style={{
                    background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047',
                    padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px',
                  }}
                  title="点击查看说明"
                >
                  ⚠ 方向待核对
                </button>
              )}
            </div>
          )}

        </div>

        <div style={{
          flex: '0 0 50px',
          width: '50px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '1px 0 2px',
        }}>
          {/* Fav button */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFav(group); }}
            style={{
              width: '38px', height: '38px',
              background: 'white',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '22px',
              color: isFav ? '#f59e0b' : '#d1d5db',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
            title={isFav ? '取消收藏' : '加入收藏'}
            aria-label={isFav ? '取消收藏' : '加入收藏'}
          >
            {isFav ? '★' : '☆'}
          </button>

          {/* Add to report button */}
          {!hideDetailsToggle && (
            <button
              onClick={handleAddToReport}
              style={{
                width: '42px', height: '42px', borderRadius: '10px',
                border: '1px solid #0d9488', background: '#14b8a6',
                color: 'white', fontSize: '24px', lineHeight: 1,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800,
                boxShadow: '0 2px 8px rgba(20,184,166,0.22)',
              }}
              title="加入当前报告"
              aria-label="加入当前报告"
            >
              +
            </button>
          )}
        </div>
      </div>

      {showSpecialPopover && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(17,24,39,0.28)',
            zIndex: 2100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={() => setShowSpecialPopover(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
              background: 'white',
              border: '1px solid #fca5a5',
              borderRadius: '12px',
              padding: '14px 14px 12px',
              boxSizing: 'border-box',
              boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
              fontSize: '13px',
              color: '#92400e',
              lineHeight: 1.65,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#dc2626', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                !
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                该项可能涉及大类招生、合作办学、特殊培养或校区差异，请核对招生章程。
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => { setShowSpecialPopover(false); setShowTipsModal(true); }}
                    style={{ color: '#b45309', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}
                  >
                    查看填报常识
                  </button>
                  <button
                    onClick={() => setShowSpecialPopover(false)}
                    style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', color: '#b91c1c', fontSize: '12px', padding: '4px 10px', flexShrink: 0 }}
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 方向待核对说明弹窗 */}
      {showDirectionWarning && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(17,24,39,0.28)',
            zIndex: 2100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={() => setShowDirectionWarning(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#fffbeb',
              border: '1px solid #fde047',
              borderRadius: '12px',
              padding: '14px 14px 12px',
              boxSizing: 'border-box',
              boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
              fontSize: '13px',
              color: '#78350f',
              lineHeight: 1.65,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>方向待核对</strong>
                <div style={{ marginTop: '6px' }}>
                  该专业方向无法稳定确认，可能属于大类招生、试验班或特殊培养项目，请核对招生章程。
                </div>
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowDirectionWarning(false)}
                    style={{ background: 'none', border: '1px solid #fde047', borderRadius: '6px', cursor: 'pointer', color: '#92400e', fontSize: '12px', padding: '4px 10px' }}
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add to report feedback */}

      {addMsg && (
        <div style={{
          marginTop: '6px', fontSize: '12px', padding: '6px 8px', borderRadius: '4px',
          background: addMsg.includes('已在') ? '#fef3c7' : '#f0fdf4',
          color: addMsg.includes('已在') ? '#92400e' : '#166534',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>{addMsg}</span>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMultiReportAdd(true); setAddMsg(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
          >选择其它报告</button>
        </div>
      )}

      {showMultiReportAdd && (
        <ReportSelectorModal 
          group={group} 
          onClose={() => {
            setShowMultiReportAdd(false);
            onReportChange?.();
          }} 
        />
      )}

      {/* Trend chart */}
      {showTrend && !hideDetailsToggle && (
        <React.Suspense fallback={
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px' }}>
            ⏳ 正在加载趋势图……
          </div>
        }>
          <div style={{ marginTop: '8px' }}>
            <AdmissionTrendChart group={group} userRank={userRank} />
          </div>
        </React.Suspense>
      )}

      {/* Tips modal */}
      {showTipsModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 2000,
          }}
          onClick={() => setShowTipsModal(false)}
        >
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'white',
              borderRadius: '16px 16px 0 0',
              padding: '20px',
              width: 'calc(100% - 24px)',
              maxWidth: '520px',
              margin: '0 auto',
              maxHeight: '80vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              boxSizing: 'border-box',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>填报常识 · 特殊项说明</h3>
              <button onClick={() => setShowTipsModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer', flexShrink: 0 }}>×</button>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <p style={{ marginBottom: '12px' }}><strong>大类招生 / 试验班：</strong>通常在大一或大二后进行专业分流。大类分流通常会参考大学期间课程成绩、专业志愿、培养方案要求等，具体以学校分流规则为准。</p>
              <p style={{ marginBottom: '12px' }}><strong>中外合作办学：</strong>通常学费较高（每年可能数万元），部分专业有出国要求，且限制转入普通专业。请结合家庭预算考虑。</p>
              <p style={{ marginBottom: '12px' }}><strong>异地校区：</strong>如"哈尔滨工业大学(威海)"、"山东大学(威海)"。毕业证通常与本部相同，但不同校区的师资、保研率、就业资源可能有差异。</p>
              <p style={{ marginBottom: '12px' }}><strong>高收费专业：</strong>学费明显高于普通专业，填报前请确认家庭可承受范围。</p>
              <p style={{ marginBottom: '12px' }}><strong>2026专业变更核查提示：</strong>2026年可能会有新增专业、专业改名、专业合并、招生计划大幅变化、选科要求变化等情况，使用时请务必核对当年的最新官方招生章程。</p>
              <p style={{ marginBottom: '12px' }}><strong>数据不全：</strong>指的是软件中没有查到相关公开数据，可能是因为学校在该年份并未在山东省该批次进行招生，或者没有公开投档最低位次等情况。</p>
              <p style={{ color: '#b45309' }}>⚠️ 以上为通用说明，具体政策以学校当年招生章程为准。</p>
            </div>
            <button className="btn btn-secondary" onClick={() => setShowTipsModal(false)} style={{ marginTop: '16px', width: '100%' }}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdmissionResultCard;

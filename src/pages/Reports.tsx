import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AdmissionReport, ReportItem } from '../types/report';
import { useAdmissionData } from '../context/AdmissionDataContext';
import { admissionRepository } from '../services/admissionRepository';
import { useSchoolMetadata } from '../hooks/useSchoolMetadata';
import { groupRecordsBySchoolMajor } from '../utils/admissionGrouping';
import DisclaimerBar from '../components/DisclaimerBar';
import {
  exportReportsAsJSON,
  parseJSONFile,
  mergeReports,
  normalizeReportsForImport,
  exportReportAsMarkdown,
  exportReportAsTxt,
} from '../utils/reportExport';
import RankingBadge from '../components/RankingBadge';
import SubjectEvaluationBadge from '../components/SubjectEvaluationBadge';
import { useMajorDirection } from '../context/MajorDirectionContext';
import { buildReportAIPrompt, copyAIPrompt } from '../utils/aiPromptBuilder';

const AdmissionTrendChart = React.lazy(() => import('../components/AdmissionTrendChart'));

// ─── localStorage key ─────────────────────────────────────────────────────────
const REPORTS_KEY = 'gaokao_reports';

const decodeReportId = (value?: string): string | null => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const safeString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' && value.trim() ? value : fallback;
};

const formatRank = (rank: number | null | undefined): string => {
  if (!rank) return '—';
  return rank.toLocaleString('zh-CN');
};

const getSafeReportItem = (item: Partial<ReportItem> | null | undefined, index: number) => {
  const schoolName = safeString(item?.schoolName, '学校名称缺失');
  const majorName = safeString(item?.majorName, '专业名称缺失');
  const order = typeof item?.order === 'number' && Number.isFinite(item.order) ? item.order : index + 1;
  const schoolCode = safeString(item?.schoolCode, '');
  const majorCode = safeString(item?.majorCode, '');
  const id = safeString(item?.id, `item_fallback_${index}_${schoolCode || 'no_school'}_${majorCode || 'no_major'}`);

  return {
    id,
    schoolCode: schoolCode || undefined,
    schoolName,
    majorCode: majorCode || undefined,
    majorName,
    note: safeString(item?.note, ''),
    order,
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
    hasIssue: !item || !item.schoolName || !item.majorName || !schoolCode || !majorCode,
  };
};

const normalizeStoredReports = (value: unknown): AdmissionReport[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((report): report is Partial<AdmissionReport> => typeof report === 'object' && report !== null)
    .map((report, reportIndex) => {
      const rawItems = Array.isArray(report.items) ? report.items : [];
      const items: ReportItem[] = rawItems
        .filter(item => typeof item === 'object' && item !== null)
        .map((rawItem, itemIndex) => {
          const item = rawItem as Partial<ReportItem>;
          return {
            id: item.id || `item_${reportIndex}_${itemIndex}`,
            schoolCode: item.schoolCode,
            schoolName: item.schoolName || '学校名称缺失',
            majorCode: item.majorCode,
            majorName: item.majorName || '专业名称缺失',
            note: item.note || '',
            order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : itemIndex + 1,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
          };
        });

      return {
        id: report.id || `report_${reportIndex}`,
        name: report.name || '未命名报告',
        note: report.note,
        items,
        createdAt: report.createdAt || new Date().toISOString(),
        updatedAt: report.updatedAt || report.createdAt || new Date().toISOString(),
      };
    });
};

// ─── ErrorBoundary for individual report items ────────────────────────────────
class ItemErrorBoundary extends React.Component<
  { children: React.ReactNode; itemLabel?: string },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode; itemLabel?: string }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, errorMsg: String(error) };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', marginBottom: '8px', fontSize: '13px', color: '#b91c1c' }}>
          ⚠️ 该候选项数据异常，无法完整展示。
          {this.props.itemLabel ? <div style={{ marginTop: '4px' }}>{this.props.itemLabel}</div> : null}
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{this.state.errorMsg}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

class ReportsErrorBoundary extends React.Component<
  { children: React.ReactNode; onBack: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onBack: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '28px 18px', color: 'var(--text-secondary)' }}>
          <p style={{ color: '#b91c1c', fontWeight: 600, marginBottom: '8px' }}>报告详情渲染异常</p>
          <p style={{ fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>
            已阻止页面白屏。请返回报告列表，或移除异常候选项后重试。
          </p>
          <button className="btn" onClick={this.props.onBack}>返回报告列表</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Inline styles for green highlight animation ──────────────────────────────
const highlightStyle: React.CSSProperties = {
  borderLeft: '4px solid #16a34a',
  transition: 'border-color 0.3s ease',
};
const normalStyle: React.CSSProperties = {
  borderLeft: '4px solid var(--primary-color)',
  transition: 'border-color 0.8s ease',
};

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId?: string }>();
  const [searchParams] = useSearchParams();
  const queryReportId = searchParams.get('reportId') ?? undefined;
  const urlReportId = queryReportId ?? reportId;
  const [reports, setReports] = useState<AdmissionReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(() => decodeReportId(urlReportId));

  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { status: admissionStatus } = useAdmissionData();
  const { getSchoolMetadata } = useSchoolMetadata();
  const { index: majorDirectionIndex } = useMajorDirection();

  const [userProfile, setUserProfile] = useState<any>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showExportBackupModal, setShowExportBackupModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Per-item UI state ───────────────────────────────────────────────────
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [moveErrors, setMoveErrors] = useState<Record<string, string>>({});
  const [highlightedItems, setHighlightedItems] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [noteSaveStatus, setNoteSaveStatus] = useState<Record<string, string>>({});
  const [inlineNoteEditingItemId, setInlineNoteEditingItemId] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string, schoolName: string, majorName: string } | null>(null);
  const moveErrorTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ─── Report-level UI state ───────────────────────────────────────────────
  const [editingReportNote, setEditingReportNote] = useState(false);
  const [reportNoteInput, setReportNoteInput] = useState('');
  const [showBackupPanel, setShowBackupPanel] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REPORTS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setReports(normalizeStoredReports(parsed));
        } catch (e) {
          console.error('Reports localStorage parse error:', e);
          setLoadError('报告数据解析失败，localStorage 中可能存在损坏数据。当前显示为空报告列表。');
        }
      }
      const savedProfile = localStorage.getItem('gaokao_user_profile');
      if (savedProfile) {
        try { setUserProfile(JSON.parse(savedProfile)); } catch (e) {}
      }
    } catch (e) {
      console.error('Reports init error:', e);
      setLoadError('报告数据读取失败：' + String(e));
    } finally {
      setDataLoaded(true);
    }
    return () => {
      Object.values(moveErrorTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    setActiveReportId(decodeReportId(urlReportId));
  }, [urlReportId]);

  // ─── Green highlight helper ──────────────────────────────────────────────
  const flashHighlight = useCallback((itemId: string) => {
    setHighlightedItems(prev => new Set(prev).add(itemId));
    setTimeout(() => {
      setHighlightedItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }, 1500);
  }, []);

  // ─── Core save ───────────────────────────────────────────────────────────
  const saveReports = (newReports: AdmissionReport[]) => {
    setReports(newReports);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(newReports));
  };

  // ─── Report list CRUD ────────────────────────────────────────────────────
  const handleCreateReport = () => {
    const name = prompt('请输入新报告名称：');
    if (!name || !name.trim()) return;
    const newReport: AdmissionReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveReports([...reports, newReport]);
  };

  const handleDeleteReport = (id: string) => {
    if (window.confirm('确定要删除该报告吗？此操作不可恢复。')) {
      saveReports(reports.filter(r => r.id !== id));
      if (activeReportId === id) navigate('/reports');
    }
  };

  const activeReport = reports.find(r => r.id === activeReportId);

  const updateActiveReport = (updates: Partial<AdmissionReport>) => {
    if (!activeReportId) return;
    const newReports = reports.map(r =>
      r.id === activeReportId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
    );
    saveReports(newReports);
  };

  // ─── Sorting: only 2025 minRank ─────────────────────────────────────────
  const sortBy2025Rank = () => {
    if (!activeReport || admissionStatus !== 'ready') return;
    const items = Array.isArray(activeReport.items) ? [...activeReport.items] : [];

    items.sort((a, b) => {
      const indexA = items.indexOf(a);
      const indexB = items.indexOf(b);
      const safeA = getSafeReportItem(a, indexA);
      const safeB = getSafeReportItem(b, indexB);
      const ga = getGroupForItem(safeA.schoolCode, safeA.majorCode);
      const gb = getGroupForItem(safeB.schoolCode, safeB.majorCode);
      const rankA = ga?.records[2025]?.minRank ?? Number.MAX_SAFE_INTEGER;
      const rankB = gb?.records[2025]?.minRank ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });

    items.forEach((item, idx) => (item.order = idx + 1));
    updateActiveReport({ items });
  };

  // ─── Move up / down / top / bottom ──────────────────────────────────────
  const moveItem = (index: number, direction: 'up' | 'down', itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeReport) return;
    const items = [...activeReport.items];
    if (direction === 'up' && index > 0) [items[index - 1], items[index]] = [items[index], items[index - 1]];
    else if (direction === 'down' && index < items.length - 1) [items[index + 1], items[index]] = [items[index], items[index + 1]];
    else return;
    items.forEach((item, idx) => (item.order = idx + 1));
    updateActiveReport({ items });
    flashHighlight(itemId);
  };

  // ─── Move to N (inline) ──────────────────────────────────────────────────
  const handleMoveToN = (index: number, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeReport) return;
    const raw = moveTargets[itemId] ?? '';
    const trimmed = raw.trim();

    const showError = (msg: string) => {
      setMoveErrors(prev => ({ ...prev, [itemId]: msg }));
      if (moveErrorTimeouts.current[itemId]) {
        clearTimeout(moveErrorTimeouts.current[itemId]);
      }
      moveErrorTimeouts.current[itemId] = setTimeout(() => {
        setMoveErrors(prev => ({ ...prev, [itemId]: '' }));
      }, 2000);
    };

    if (!/^\d+$/.test(trimmed)) {
      showError('未定义行为');
      return;
    }
    const num = Number(trimmed);
    if (num < 1) {
      showError('未定义行为');
      return;
    }

    setMoveErrors(prev => ({ ...prev, [itemId]: '' }));
    if (moveErrorTimeouts.current[itemId]) {
      clearTimeout(moveErrorTimeouts.current[itemId]);
    }
    const items = [...activeReport.items];
    const target = Math.min(num - 1, items.length - 1);
    const [movedItem] = items.splice(index, 1);
    items.splice(target, 0, movedItem);
    items.forEach((item, idx) => (item.order = idx + 1));
    updateActiveReport({ items });
    setMoveTargets(prev => ({ ...prev, [itemId]: '' }));
    flashHighlight(itemId);
  };

  // ─── Item CRUD ───────────────────────────────────────────────────────────
  const handleEditName = () => {
    const newName = prompt('修改报告名称：', activeReport?.name);
    if (newName && newName.trim()) updateActiveReport({ name: newName.trim() });
  };

  const handleSaveItemNote = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeReport) return;
    const newNote = editingNotes[itemId] ?? '';
    const items = activeReport.items.map(item =>
      item.id === itemId ? { ...item, note: newNote, updatedAt: new Date().toISOString() } : item
    );
    updateActiveReport({ items });
    setNoteSaveStatus(prev => ({ ...prev, [itemId]: '✅ 已保存' }));
    setTimeout(() => setNoteSaveStatus(prev => ({ ...prev, [itemId]: '' })), 2000);
  };

  const handleDeleteItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeReport) return;
    const item = activeReport.items.find(i => i.id === itemId);
    if (item) {
      setDeleteConfirmItem({ id: itemId, schoolName: item.schoolName, majorName: item.majorName });
    }
  };

  // ─── JSON Import / Export ────────────────────────────────────────────────
  const handleExportJSON = () => {
    if (reports.length === 0) { alert('当前没有可导出的报告。'); return; }
    exportReportsAsJSON(reports);
  };

  const handleImportClick = () => {
    setImportStatus(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const result = await parseJSONFile(file);
    if (!result.ok || !result.backup) {
      setImportStatus(`❌ 导入失败：${result.error}`);
      return;
    }

    const importedReports = result.backup.reports;
    
    // Format imported report names: name_DDHHmm
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateSuffix = `${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
    importedReports.forEach((r: AdmissionReport) => {
      r.name = `${r.name}_${dateSuffix}`;
    });

    const mode = window.confirm(
      `文件校验通过，包含 ${importedReports.length} 个报告。\n\n` +
      `请选择导入方式：\n` +
      `• 点击【确定】→ 合并（保留当前报告，追加导入内容，ID 冲突时自动生成新 ID）\n` +
      `• 点击【取消】→ 进入覆盖确认`
    );

    if (mode) {
      const merged = mergeReports(reports, importedReports);
      saveReports(merged);
      setImportStatus(`✅ 合并导入成功，共追加 ${importedReports.length} 个报告，当前共 ${merged.length} 个报告。`);
    } else {
      if (
        window.confirm(
          `覆盖模式：当前所有 ${reports.length} 个报告将被删除，替换为导入的 ${importedReports.length} 个报告。\n\n确认覆盖？`
        )
      ) {
        const normalizedImportedReports = normalizeReportsForImport(importedReports);
        saveReports(normalizedImportedReports);
        navigate('/reports');
        setImportStatus(`✅ 覆盖导入成功，共 ${normalizedImportedReports.length} 个报告。`);
      } else {
        setImportStatus('已取消导入。');
      }
    }
  };

  // ─── Markdown / TXT Export ───────────────────────────────────────────────
  const getGroupForItem = (schoolCode: string | undefined, majorCode: string | undefined) => {
    if (admissionStatus !== 'ready' || !schoolCode || !majorCode) return null;
    try {
      const records = admissionRepository.getAllRecords().filter(
        r => r.schoolCode === schoolCode && r.majorCode === majorCode
      );
      return groupRecordsBySchoolMajor(records)[0] ?? null;
    } catch (e) {
      console.error('getGroupForItem error:', e);
      return null;
    }
  };

  const getSchoolMetaForItem = (schoolCode: string | undefined, schoolName: string) => {
    try {
      return getSchoolMetadata(schoolCode, schoolName) ?? null;
    } catch (e) {
      console.error('getSchoolMetaForItem error:', e);
      return null;
    }
  };

  const handleExportMarkdown = () => {
    if (!activeReport) return;
    exportReportAsMarkdown({
      report: activeReport,
      userProfile,
      getGroupData: getGroupForItem,
      getSchoolMeta: getSchoolMetaForItem,
    });
  };

  const handleExportTxt = () => {
    if (!activeReport) return;
    exportReportAsTxt({
      report: activeReport,
      userProfile,
      getGroupData: getGroupForItem,
      getSchoolMeta: getSchoolMetaForItem,
    });
  };

  // ─── AI prompt ───────────────────────────────────────────────────────────
  const [exportPromptCandidatesOnly, setExportPromptCandidatesOnly] = useState(false);
  const [includePromptMajorNameConfusionCheck, setIncludePromptMajorNameConfusionCheck] = useState(false);

  const generateAIPrompt = () => {
    if (!activeReport) return '';
    return buildReportAIPrompt({
      profile: userProfile,
      reports: reports,
      selectedReportId: activeReport.id,
      includeBaseInfo: true,
      includeLabels: true,
      exportCandidatesOnly: exportPromptCandidatesOnly,
      includeMajorNameConfusionCheck: includePromptMajorNameConfusionCheck,
      status: 'ready',
    });
  };

  const copyPrompt = () => {
    const text = generateAIPrompt();
    copyAIPrompt(
      text,
      exportPromptCandidatesOnly
        ? '候选专业信息已复制到剪贴板。'
        : 'Prompt 已复制到剪贴板！请粘贴至 AI 工具，并确保为其打开了联网功能。',
    );
  };

  // ─── Toggle expand ────────────────────────────────────────────────────────
  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // ─── Render single report item ─────────────────────────────────────────────
  const renderReportItem = (item: ReportItem, index: number, itemCount: number) => {
    const safeItem = getSafeReportItem(item, index);
    const isExpanded = expandedItems.has(safeItem.id);
    const isHighlighted = highlightedItems.has(safeItem.id);
    const moveTarget = moveTargets[safeItem.id] ?? '';
    const moveError = moveErrors[safeItem.id] ?? '';
    const currentNote = editingNotes[safeItem.id] ?? safeItem.note;
    const saveStatus = noteSaveStatus[safeItem.id] ?? '';

    let group: ReturnType<typeof groupRecordsBySchoolMajor>[0] | undefined;
    let meta: ReturnType<typeof getSchoolMetadata> | null = null;
    try {
      if (admissionStatus === 'ready') {
        group = getGroupForItem(safeItem.schoolCode, safeItem.majorCode) ?? undefined;
      }
      meta = getSchoolMetaForItem(safeItem.schoolCode, safeItem.schoolName);
    } catch (e) {
      console.error('renderReportItem data error:', e);
    }

    const rank2025 = group?.records[2025]?.minRank ?? null;
    const plan2025 = group?.records[2025]?.planCount ?? null;
    const rank2024 = group?.records[2024]?.minRank ?? null;
    const plan2024 = group?.records[2024]?.planCount ?? null;
    const rank2023 = group?.records[2023]?.minRank ?? null;
    const plan2023 = group?.records[2023]?.planCount ?? null;
    const score2025 = group?.records[2025]?.minScore ?? null;
    const score2024 = group?.records[2024]?.minScore ?? null;
    const score2023 = group?.records[2023]?.minScore ?? null;

    const tags = meta?.schoolTypeTags ?? [];

    return (
      <ItemErrorBoundary key={safeItem.id} itemLabel={`${safeItem.schoolName} — ${safeItem.majorName}`}>
        <div
          className="card"
          style={{
            marginBottom: '8px',
            padding: '0',
            overflow: 'hidden',
            ...(isHighlighted ? highlightStyle : normalStyle),
          }}
        >
          {/* ── Collapsed row (always visible) ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              cursor: 'pointer',
              padding: '10px 12px',
              gap: '8px',
            }}
            onClick={() => toggleExpand(safeItem.id)}
          >
            {/* Order number */}
            <div style={{
              flexShrink: 0,
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--primary-color)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              marginTop: '2px',
            }}>
              {safeItem.order}
            </div>

            {/* Main info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                  {safeItem.schoolName}
                </span>
                <RankingBadge schoolCode={safeItem.schoolCode} schoolName={safeItem.schoolName} />
                {meta?.city && (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {meta.city}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--primary-color)', marginTop: '2px', overflowWrap: 'anywhere', lineHeight: 1.4 }}>
                <span>{safeItem.majorName}</span>
                <span style={{ display: 'inline-block', marginLeft: '6px', verticalAlign: 'middle' }}>
                  <SubjectEvaluationBadge
                    schoolCode={safeItem.schoolCode}
                    schoolName={safeItem.schoolName}
                    majorName={safeItem.majorName}
                    majorDirectionIndex={majorDirectionIndex}
                  />
                </span>
              </div>

              {/* Tags row */}
              {tags.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                  {tags.map((tag: string) => (
                    <span key={tag} style={{
                      fontSize: '11px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: tag === '985' ? '#fef3c7' : tag === '211' ? '#dbeafe' : tag === '双一流' ? '#f3e8ff' : '#f1f5f9',
                      color: tag === '985' ? '#92400e' : tag === '211' ? '#1e40af' : tag === '双一流' ? '#6b21a8' : 'var(--text-secondary)',
                      fontWeight: 500,
                    }}>{tag}</span>
                  ))}
                </div>
              )}

              {/* Rank & Plan row */}
              {rank2025 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    位次：{formatRank(rank2025)}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    计划：{plan2025 ?? '暂无'}
                  </span>
                </div>
              )}

              {/* Note display / edit row */}
              {inlineNoteEditingItemId === safeItem.id ? (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }} onClick={e => e.stopPropagation()}>
                  <textarea
                    autoFocus
                    value={currentNote}
                    onChange={e => setEditingNotes(prev => ({ ...prev, [safeItem.id]: e.target.value }))}
                    rows={2}
                    placeholder="在此输入备注..."
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      resize: 'vertical',
                      background: 'var(--input-bg, #fff)',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button className="btn" style={{ fontSize: '12px', padding: '3px 8px' }} onClick={(e) => { e.stopPropagation(); handleSaveItemNote(safeItem.id, e); setInlineNoteEditingItemId(null); }}>保存</button>
                    <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '3px 8px' }} onClick={(e) => { e.stopPropagation(); setInlineNoteEditingItemId(null); }}>取消</button>
                    {saveStatus && <span style={{ fontSize: '11px', color: '#16a34a' }}>{saveStatus}</span>}
                  </div>
                </div>
              ) : safeItem.note ? (
                <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '3px 6px', borderRadius: '4px', marginTop: '5px', overflowWrap: 'anywhere' }}>
                  📝 {safeItem.note}
                </div>
              ) : null}

              {safeItem.hasIssue && (
                <div style={{ fontSize: '12px', color: '#b91c1c', background: '#fef2f2', padding: '4px 6px', borderRadius: '4px', marginTop: '5px', border: '1px solid #fecaca' }}>
                  ⚠️ 该候选项数据异常
                </div>
              )}
            </div>

            {/* ── Action buttons: 3-row compact grid (right side) ── */}
            <div
              style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '6px', alignItems: 'flex-end', justifyContent: 'center' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Row 1: 上移 / 下移 */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  style={{ background: 'none', border: 'none', padding: '2px 4px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: index === 0 ? 'var(--text-tertiary, #9ca3af)' : 'var(--primary-color)', textDecoration: 'underline', cursor: index === 0 ? 'not-allowed' : 'pointer', lineHeight: 1 }}
                  onClick={(e) => moveItem(index, 'up', safeItem.id, e)}
                  disabled={index === 0}
                  title="上移一位"
                >上移</button>
                <button
                  style={{ background: 'none', border: 'none', padding: '2px 4px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: index === itemCount - 1 ? 'var(--text-tertiary, #9ca3af)' : 'var(--primary-color)', textDecoration: 'underline', cursor: index === itemCount - 1 ? 'not-allowed' : 'pointer', lineHeight: 1 }}
                  onClick={(e) => moveItem(index, 'down', safeItem.id, e)}
                  disabled={index === itemCount - 1}
                  title="下移一位"
                >下移</button>
              </div>
              {/* Row 2: 移至 [ ] 位 [移] */}
              <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>移至第</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={moveTarget}
                  onChange={e => {
                    setMoveTargets(prev => ({ ...prev, [safeItem.id]: e.target.value }));
                    setMoveErrors(prev => ({ ...prev, [safeItem.id]: '' }));
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '32px',
                    height: '22px',
                    padding: '0 2px',
                    fontSize: '12px',
                    border: `1px solid ${moveError ? '#ef4444' : 'var(--border-color, #e2e8f0)'}`,
                    borderRadius: '4px',
                    textAlign: 'center',
                    background: 'var(--input-bg, #fff)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                  }}
                  title={`移至第几位（共 ${itemCount} 项）`}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>位</span>
                <button
                  style={{ background: 'none', border: 'none', padding: '2px 4px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--primary-color)', textDecoration: 'underline', cursor: 'pointer', lineHeight: 1 }}
                  onClick={(e) => handleMoveToN(index, safeItem.id, e)}
                  title="执行移动"
                >移</button>
              </div>
              {/* move error hint */}
              {moveError && (
                <div style={{ fontSize: '11px', color: '#ef4444', textAlign: 'right', lineHeight: 1.2, marginTop: '-2px' }}>{moveError}</div>
              )}
              {/* Row 3: 添加备注 | 展开/收起 | 删除 */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  style={{ background: 'none', border: 'none', padding: '2px 4px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--primary-color)', textDecoration: 'underline', cursor: 'pointer', lineHeight: 1 }}
                  onClick={(e) => { e.stopPropagation(); setEditingNotes(prev => ({ ...prev, [safeItem.id]: prev[safeItem.id] ?? safeItem.note })); setInlineNoteEditingItemId(safeItem.id); }}
                  title={safeItem.note ? '编辑备注' : '添加备注'}
                >{safeItem.note ? '编辑备注' : '添加备注'}</button>
                <button
                  style={{ background: 'none', border: 'none', padding: '2px 4px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--primary-color)', textDecoration: 'underline', cursor: 'pointer', lineHeight: 1 }}
                  onClick={(e) => { e.stopPropagation(); toggleExpand(safeItem.id); }}
                  title={isExpanded ? '收起详情' : '展开详情'}
                >{isExpanded ? '收起' : '展开'}</button>
                <button
                  style={{ background: 'none', border: 'none', padding: '2px 4px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#b91c1c', textDecoration: 'underline', cursor: 'pointer', lineHeight: 1 }}
                  onClick={(e) => handleDeleteItem(safeItem.id, e)}
                  title="从报告中删除该志愿"
                >删除</button>
              </div>
            </div>
          </div>

          {/* ── Expanded section ── */}
          {isExpanded && (
            <div
              style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', padding: '12px', background: 'var(--card-bg-secondary, rgba(0,0,0,0.02))' }}
              onClick={e => e.stopPropagation()}
            >
              {/* No history data warning */}
              {admissionStatus === 'ready' && !group && (
                <div style={{ fontSize: '12px', color: '#92400e', background: '#fffbeb', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #fde68a', lineHeight: 1.5 }}>
                  ℹ️ 当前录取库中未找到该候选项的历史数据，可能是专业名称变化或数据版本变化。
                </div>
              )}

              {/* Year data table */}
              {group && (
                <div style={{ marginBottom: '12px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>年份</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>最低位次</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>计划数</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>最低分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { year: 2025, rank: rank2025, plan: plan2025, score: score2025 },
                        { year: 2024, rank: rank2024, plan: plan2024, score: score2024 },
                        { year: 2023, rank: rank2023, plan: plan2023, score: score2023 },
                      ].map(({ year, rank, plan, score }) => (
                        <tr key={year} style={{ borderTop: '1px solid var(--border-color, #f1f5f9)' }}>
                          <td style={{ padding: '5px 6px', fontWeight: 600 }}>{year}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', color: rank ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {rank ? formatRank(rank) : '—'}
                          </td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {plan ?? '—'}
                          </td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', color: score ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '11px' }}>
                            {score ? `${score}分` : '官方投档表未提供'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Trend chart (lazy) */}
              {group && (
                <React.Suspense fallback={<div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px 0' }}>正在加载趋势图...</div>}>
                  <AdmissionTrendChart group={group} userRank={userProfile?.rank} />
                </React.Suspense>
              )}

              {/* Note editing */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>候选项备注</div>
                <textarea
                  value={currentNote}
                  onChange={e => {
                    setEditingNotes(prev => ({ ...prev, [safeItem.id]: e.target.value }));
                  }}
                  onClick={e => e.stopPropagation()}
                  rows={2}
                  placeholder="在此输入备注..."
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    resize: 'vertical',
                    background: 'var(--input-bg, #fff)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <button
                    className="btn"
                    style={{ fontSize: '12px', padding: '4px 12px' }}
                    onClick={(e) => handleSaveItemNote(safeItem.id, e)}
                  >
                    保存备注
                  </button>
                  {saveStatus && (
                    <span style={{ fontSize: '12px', color: '#16a34a' }}>{saveStatus}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </ItemErrorBoundary>
    );
  };

  // ─── Report list view ─────────────────────────────────────────────────────

  if (!dataLoaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="header">
          <h1 style={{ fontSize: '17px' }}>我的报告</h1>
        </header>
        <div className="page-container" style={{ flex: 1 }}>
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
            正在加载报告数据…
          </div>
        </div>
      </div>
    );
  }

  if (!activeReportId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="header">
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
          <h1 style={{ fontSize: '17px' }}>我的报告</h1>
        </header>
        <div className="page-container" style={{ flex: 1 }}>
          {loadError && (
            <div className="notice-bar notice-bar--warning" style={{ marginBottom: '16px' }}>
              <strong>⚠️ 数据读取错误：</strong>{loadError}
            </div>
          )}

          <div className="notice-bar notice-bar--warning" style={{ marginBottom: '16px' }}>
            <strong>⚠️ 报告备份提醒：</strong>
            本应用的数据保存在当前设备的本地存储中，<strong>更换设备、清除应用数据或卸载应用可能导致本地报告丢失</strong>。
            建议整理完毕后及时导出 JSON 备份，并妥善保存。
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setShowBackupPanel(!showBackupPanel)}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                🗄️ 数据备份与导入
              </div>
              <div style={{ fontSize: '12px', color: 'var(--primary-color)' }}>
                {showBackupPanel ? '收起' : '展开'}
              </div>
            </div>
            
            {showBackupPanel && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                <button className="btn" style={{ fontSize: '13px' }} onClick={handleExportJSON}>
                  ⬇ 导出全部报告备份 (JSON)
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '13px' }} onClick={handleImportClick}>
                  ⬆ 导入报告备份
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>
            )}
            
            {importStatus && showBackupPanel && (
              <div style={{
                fontSize: '13px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: importStatus.startsWith('✅') ? '#f0fdf4' : importStatus.startsWith('❌') ? '#fef2f2' : '#f8fafc',
                color: importStatus.startsWith('✅') ? '#166534' : importStatus.startsWith('❌') ? '#b91c1c' : 'var(--text-secondary)',
                marginTop: '4px',
              }}>
                {importStatus}
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px' }}>志愿整理报告系统</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  创建多个方案，将查询页中的选项加入方案中进行比对和排序。
                </p>
              </div>
              <button className="btn" onClick={handleCreateReport}>+ 创建新报告</button>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📄</div>
                <p style={{ marginBottom: '8px', fontWeight: 500 }}>还没有报告</p>
                <p>先创建一个报告，再从查询结果中把候选专业加入报告。</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reports.map(r => (
                <div
                  key={r.id}
                  className="card"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => navigate(`/reports?reportId=${encodeURIComponent(r.id)}`)}
                >
                  <div>
                    <h3 style={{ fontSize: '16px', color: 'var(--primary-color)' }}>{r.name}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      共 {Array.isArray(r.items) ? r.items.length : 0} 个候选项 | 更新时间: {new Date(r.updatedAt).toLocaleString()}
                    </div>
                    {r.note && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>备注: {r.note}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={e => { e.stopPropagation(); handleDeleteReport(r.id); }}
                      style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fca5a5' }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DisclaimerBar />
      </div>
    );
  }

  // ─── Active Report Detail View ─────────────────────────────────────────────
  if (!activeReport) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="header">
          <button onClick={() => navigate('/reports')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
          <h1 style={{ fontSize: '17px' }}>我的报告</h1>
        </header>
        <div className="page-container" style={{ flex: 1 }}>
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📄</div>
            <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px', color: 'var(--text-primary)' }}>未找到该报告</p>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>未找到该报告，可能已被删除或本地数据已变化。</p>
            <button className="btn" onClick={() => navigate('/reports')}>返回报告列表</button>
          </div>
        </div>
        <DisclaimerBar />
      </div>
    );
  }

  const safeItems = Array.isArray(activeReport.items) ? activeReport.items : [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <button onClick={() => navigate('/reports')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
        <h1 style={{ fontSize: '17px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={handleEditName} title="点击修改名称">{activeReport.name}</h1>
      </header>
      <div className="page-container" style={{ flex: 1 }}>
        <ReportsErrorBoundary onBack={() => navigate('/reports')}>

          {/* ── Row 1: Report note + edit button ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'nowrap' }}>
            {editingReportNote ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                <textarea
                  autoFocus
                  value={reportNoteInput}
                  onChange={e => setReportNoteInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      setEditingReportNote(false);
                      updateActiveReport({ note: reportNoteInput.trim() });
                    }
                    if (e.key === 'Escape') setEditingReportNote(false);
                  }}
                  rows={2}
                  style={{
                    fontSize: '13px',
                    padding: '6px 8px',
                    borderRadius: '5px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    width: '100%',
                    minWidth: 0,
                    resize: 'vertical',
                    background: 'var(--input-bg, #fff)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="报告备注..."
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 12px', width: 'auto', minHeight: 'auto' }} onClick={() => setEditingReportNote(false)}>取消</button>
                  <button className="btn" style={{ fontSize: '12px', padding: '4px 12px', width: 'auto', minHeight: 'auto' }} onClick={() => {
                    updateActiveReport({ note: reportNoteInput.trim() });
                    setEditingReportNote(false);
                  }}>保存</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: activeReport.note ? 'var(--text-secondary)' : 'var(--text-tertiary, #9ca3af)', overflowWrap: 'anywhere', lineHeight: 1.5, paddingTop: '4px' }}>
                  {activeReport.note ? `📝 ${activeReport.note}` : '📝 暂无备注'}
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', padding: '4px 10px', flexShrink: 0, marginLeft: '8px', whiteSpace: 'nowrap', width: 'auto', minHeight: 'auto' }}
                  onClick={() => {
                    setReportNoteInput(activeReport.note || '');
                    setEditingReportNote(true);
                  }}
                >编辑备注</button>
              </>
            )}
          </div>

          {/* ── Row 2: Action buttons ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '5px 12px' }}
              onClick={() => setShowExportBackupModal(true)}
            >
              导出与备份
            </button>
            {safeItems.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '5px 12px' }}
                onClick={sortBy2025Rank}
                disabled={admissionStatus !== 'ready'}
                title={admissionStatus !== 'ready' ? '录取数据加载中...' : '按2025年最低位次升序排列'}
              >
                ↕ 按2025最低位次排序
              </button>
            )}
          </div>



          {/* ── Item list ── */}
          {safeItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0', fontSize: '14px' }}>
              报告内暂无候选项。请从查询结果中点击 "+" 添加。
            </div>
          ) : (
            <div>
              {safeItems.map((item, idx) => renderReportItem(item, idx, safeItems.length))}
            </div>
          )}

          {/* ── AI prompt textarea (at bottom) ── */}
          {safeItems.length > 0 && (
            <div className="card" style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {exportPromptCandidatesOnly ? '候选专业信息（仅导出）' : 'AI 核查 Prompt（手动复制到 AI 工具）'}
                <button className="btn" style={{ width: 'auto', fontSize: '12px', padding: '4px 12px' }} onClick={copyPrompt}>
                  {exportPromptCandidatesOnly ? '复制候选专业信息' : '复制 AI 核查 Prompt'}
                </button>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
                {exportPromptCandidatesOnly
                  ? '当前模式只导出报告中的候选专业信息，不添加 AI 核查要求。'
                  : (
                    <>
                      将以下文本复制后粘贴到 AI 工具中辅助复核。
                      💡 <strong>提示：</strong>部分国内 AI 疑似不支持回答相关问题，可切换其它 AI；请务必为 AI <strong>打开联网功能</strong>，以进行搜索和核对。
                    </>
                  )}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={exportPromptCandidatesOnly}
                    onChange={e => setExportPromptCandidatesOnly(e.target.checked)}
                  />
                  仅导出候选专业信息，不添加 AI 核查要求
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: exportPromptCandidatesOnly ? '#9ca3af' : 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={includePromptMajorNameConfusionCheck}
                    onChange={e => setIncludePromptMajorNameConfusionCheck(e.target.checked)}
                    disabled={exportPromptCandidatesOnly}
                  />
                  核对是否有引起混淆的专业名称
                </label>
              </div>
              <textarea
                className="form-control"
                style={{ width: '100%', height: '220px', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical' }}
                readOnly
                value={generateAIPrompt()}
              />
            </div>
          )}

          {showExportBackupModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
              display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
            }} onClick={() => setShowExportBackupModal(false)}>
              <div style={{
                background: 'var(--bg-color, white)', width: '100%', maxWidth: '480px',
                borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
                padding: '20px', paddingBottom: 'env(safe-area-inset-bottom, 20px)',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
              }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>导出与备份</h3>
                  <button onClick={() => setShowExportBackupModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button className="btn" style={{ padding: '10px', fontSize: '14px', width: '100%', display: 'block' }} onClick={() => { setShowExportBackupModal(false); copyPrompt(); }} disabled={safeItems.length === 0}>
                    🤖 {exportPromptCandidatesOnly ? '复制候选专业信息' : '复制 AI 核查 Prompt'}
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '10px', fontSize: '14px', width: '100%', display: 'block' }} onClick={() => { setShowExportBackupModal(false); handleExportMarkdown(); }} disabled={safeItems.length === 0}>
                    📄 导出 Markdown
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '10px', fontSize: '14px', width: '100%', display: 'block' }} onClick={() => { setShowExportBackupModal(false); handleExportTxt(); }} disabled={safeItems.length === 0}>
                    📃 导出 TXT
                  </button>
                  <div style={{ height: '1px', background: 'var(--border-color, #e2e8f0)', margin: '4px 0' }} />
                  <button className="btn btn-secondary" style={{ padding: '10px', fontSize: '14px', width: '100%', display: 'block' }} onClick={() => { setShowExportBackupModal(false); handleExportJSON(); }}>
                    💾 导出 JSON 备份
                  </button>
                </div>
              </div>
            </div>
          )}

          {deleteConfirmItem && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
            }} onClick={() => setDeleteConfirmItem(null)}>
              <div style={{
                background: 'var(--bg-color, white)', width: '90%', maxWidth: '320px',
                borderRadius: '8px', padding: '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-primary)' }}>确认删除志愿？</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>确定要从报告中删除该志愿吗？</p>
                <div style={{ fontSize: '13px', color: 'var(--primary-color)', marginBottom: '20px', padding: '8px', background: 'var(--card-bg-secondary, #f8fafc)', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 600 }}>{deleteConfirmItem.schoolName}</div>
                  <div style={{ marginTop: '2px' }}>{deleteConfirmItem.majorName}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={() => setDeleteConfirmItem(null)}>取消</button>
                  <button className="btn" style={{ background: '#b91c1c', borderColor: '#b91c1c' }} onClick={() => {
                    if (activeReport) {
                      const items = activeReport.items.filter(item => item.id !== deleteConfirmItem.id);
                      items.forEach((item, idx) => (item.order = idx + 1));
                      updateActiveReport({ items });
                      setDeleteConfirmItem(null);
                    }
                  }}>确认删除</button>
                </div>
              </div>
            </div>
          )}
        </ReportsErrorBoundary>
      </div>
      <DisclaimerBar />
    </div>
  );
};

export default Reports;

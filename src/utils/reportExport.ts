import type { AdmissionReport, ReportItem } from '../types/report';
import type { GroupedAdmission } from './admissionGrouping';
import { getTrendLabel, getReferenceLabel } from './admissionAnalysis';
import { exportTextFile, exportJsonFile } from './exportFile';

// ─── JSON Backup ───────────────────────────────────────────────────────────────

export const BACKUP_VERSION = '1.0';

export interface ReportBackup {
  version: string;
  exportedAt: string;
  appName: string;
  reports: AdmissionReport[];
}

export function exportReportsAsJSON(reports: AdmissionReport[]): void {
  const backup: ReportBackup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appName: '山东高考志愿助手 Gaokao Insight',
    reports: JSON.parse(JSON.stringify(reports)),
  };
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const fileName = `gaokao_reports_backup_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;

  exportJsonFile(fileName, backup);
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  backup?: ReportBackup;
}

export function validateBackup(raw: unknown): ImportResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: '文件内容不是有效的 JSON 对象。' };
  }
  const obj = raw as Record<string, unknown>;
  if (!obj.version || typeof obj.version !== 'string') {
    return { ok: false, error: '文件缺少 version 字段，可能不是本应用导出的备份。' };
  }
  if (!Array.isArray(obj.reports)) {
    return { ok: false, error: '文件缺少 reports 数组，格式不正确。' };
  }
  // Basic check on reports
  for (let i = 0; i < obj.reports.length; i++) {
    const r = obj.reports[i] as Record<string, unknown>;
    if (!r.id || !r.name || !Array.isArray(r.items)) {
      return { ok: false, error: `第 ${i + 1} 条报告格式不正确：缺少 id、name 或 items 字段。` };
    }
    for (let j = 0; j < r.items.length; j++) {
      if (typeof r.items[j] !== 'object' || r.items[j] === null) {
        return { ok: false, error: `第 ${i + 1} 条报告的第 ${j + 1} 个候选项格式不正确。` };
      }
    }
  }
  return { ok: true, backup: obj as unknown as ReportBackup };
}

export function parseJSONFile(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      resolve({ ok: false, error: '请选择 .json 格式的文件。' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        resolve(validateBackup(parsed));
      } catch {
        resolve({ ok: false, error: 'JSON 解析失败，文件可能已损坏。' });
      }
    };
    reader.onerror = () => resolve({ ok: false, error: '文件读取失败。' });
    reader.readAsText(file, 'utf-8');
  });
}

function createUniqueId(prefix: string, usedIds: Set<string>): string {
  let id = '';
  do {
    id = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

const safeString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' && value.trim() ? value : fallback;
};

function normalizeExportItem(item: Partial<ReportItem> | null | undefined, index: number): ReportItem {
  return {
    id: safeString(item?.id, `item_export_${index}`),
    schoolCode: safeString(item?.schoolCode, '') || undefined,
    schoolName: safeString(item?.schoolName, '学校名称缺失'),
    majorCode: safeString(item?.majorCode, '') || undefined,
    majorName: safeString(item?.majorName, '专业名称缺失'),
    note: safeString(item?.note, ''),
    order: typeof item?.order === 'number' && Number.isFinite(item.order) ? item.order : index + 1,
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
  };
}

function getOrderedItems(items: ReportItem[] | undefined): ReportItem[] {
  const safeItems = Array.isArray(items) ? items : [];
  return safeItems
    .map((item, index) => normalizeExportItem(item, index))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const orderA = Number.isFinite(a.item.order) ? a.item.order : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(b.item.order) ? b.item.order : Number.MAX_SAFE_INTEGER;
      return orderA === orderB ? a.index - b.index : orderA - orderB;
    })
    .map(({ item }) => item);
}

export function normalizeReportsForImport(
  imported: AdmissionReport[],
  current: AdmissionReport[] = []
): AdmissionReport[] {
  const usedReportIds = new Set(current.map(report => report.id));
  const usedItemIds = new Set(current.flatMap(report => Array.isArray(report.items) ? report.items.map(item => item.id) : []));

  return imported.map(report => {
    const reportIdConflicted = usedReportIds.has(report.id);
    const reportId = reportIdConflicted ? createUniqueId('report', usedReportIds) : report.id;
    usedReportIds.add(reportId);

    const items = getOrderedItems(report.items).map((item, index) => {
      const itemIdConflicted = !item.id || usedItemIds.has(item.id);
      const itemId = itemIdConflicted ? createUniqueId('item', usedItemIds) : item.id;
      usedItemIds.add(itemId);
      return {
        ...item,
        id: itemId,
        order: index + 1,
      };
    });

    return {
      ...report,
      id: reportId,
      name: reportIdConflicted ? `${report.name}（导入）` : report.name,
      items,
    };
  });
}

/**
 * Merge imported reports into current reports.
 * If report or item IDs conflict, generate new IDs for imported data.
 */
export function mergeReports(current: AdmissionReport[], imported: AdmissionReport[]): AdmissionReport[] {
  return [...current, ...normalizeReportsForImport(imported, current)];
}

// ─── Markdown / TXT Export ────────────────────────────────────────────────────

interface ReportExportOptions {
  report: AdmissionReport;
  userProfile?: {
    province?: string;
    examYear?: number;
    subjects?: string[];
    score?: number;
    rank?: number;
    preferredCities?: string[];
    strategy?: string;
  } | null;
  getGroupData: (schoolCode: string | undefined, majorCode: string | undefined) => GroupedAdmission | null;
  getSchoolMeta: (schoolCode: string | undefined, schoolName: string) => { city?: string; schoolTypeTags?: string[] } | null;
}

function buildReportText(opts: ReportExportOptions): string {
  const { report, userProfile, getGroupData, getSchoolMeta } = opts;
  const orderedItems = getOrderedItems(report.items);
  const lines: string[] = [];

  lines.push(`报告名称：${report.name}`);
  if (report.note) lines.push(`报告备注：${report.note}`);
  lines.push(`创建时间：${new Date(report.createdAt).toLocaleString('zh-CN')}`);
  lines.push(`更新时间：${new Date(report.updatedAt).toLocaleString('zh-CN')}`);
  lines.push('');

  if (userProfile) {
    lines.push('【考生基本信息】');
    if (userProfile.province) lines.push(`省份：${userProfile.province}`);
    if (userProfile.examYear) lines.push(`年份：${userProfile.examYear}`);
    if (userProfile.subjects?.length) lines.push(`选科：${userProfile.subjects.join(' + ')}`);
    if (userProfile.score) lines.push(`分数：${userProfile.score} 分`);
    if (userProfile.rank) lines.push(`位次：${userProfile.rank} 位`);
    if (userProfile.preferredCities?.length) lines.push(`偏好城市：${userProfile.preferredCities.join('、')}`);
    if (userProfile.strategy) lines.push(`填报策略：${userProfile.strategy}`);
    lines.push('');
  }

  lines.push(`【候选项列表】共 ${orderedItems.length} 项`);
  lines.push('');

  orderedItems.forEach((item) => {
    const group = getGroupData(item.schoolCode, item.majorCode);
    const meta = getSchoolMeta(item.schoolCode, item.schoolName);
    const rank2025 = group?.records[2025]?.minRank ?? null;
    const rank2024 = group?.records[2024]?.minRank ?? null;
    const rank2023 = group?.records[2023]?.minRank ?? null;
    const trendLabel = getTrendLabel([rank2025, rank2024, rank2023]);
    const referenceLabel = getReferenceLabel(userProfile?.rank, group?.latestRecord?.minRank ?? null);

    lines.push(`─── 选项 ${item.order} ───────────────────────────────`);
    lines.push(`学校：${item.schoolName}`);
    lines.push(`专业/专业类：${item.majorName}`);
    if (meta?.city) lines.push(`城市：${meta.city}`);
    if (meta?.schoolTypeTags?.length) lines.push(`学校标签：${meta.schoolTypeTags.join(' | ')}`);
    if (item.note) lines.push(`我的备注：${item.note}`);
    lines.push(`趋势标签：${trendLabel}`);
    lines.push(`参考标签：${referenceLabel}`);
    lines.push('');
    lines.push('近三年录取数据：');

    [2023, 2024, 2025].forEach(year => {
      const r = group?.records[year];
      if (r) {
        const scoreStr = r.minScore != null ? `${r.minScore} 分` : '官方投档表未提供';
        lines.push(`  ${year} 年：最低分 ${scoreStr}，最低位次 ${r.minRank} 位，计划数 ${r.planCount ?? '—'}`);
      } else {
        lines.push(`  ${year} 年：暂无数据 / 未开始招生`);
      }
    });

    lines.push('');
  });

  lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  lines.push('\u3010\u7ed9 AI \u7684\u6838\u67e5\u8981\u6c42\u3011');
  lines.push('');
  lines.push('\u3010\u26a0\ufe0f \u4e13\u4e1a\u540d\u79f0\u6df7\u6dc6\u68c0\u67e5\u2014\u2014\u8bf7\u5728\u56de\u7b54\u5f00\u5934\u4f18\u5148\u5b8c\u6210\u3011');
  lines.push('\u8bf7\u4f18\u5148\u68c0\u67e5\u5019\u9009\u4e13\u4e1a\u540d\u79f0\u662f\u5426\u5b58\u5728\u5bb9\u6613\u6df7\u6dc6\u7684\u60c5\u51b5\uff0c\u4f8b\u5982\u201c\u8f6f\u4ef6\u5de5\u7a0b\u201d\u548c\u201c\u5de5\u7a0b\u8f6f\u4ef6\u201d\u8fd9\u7c7b\u540d\u79f0\u76f8\u8fd1\u4f46\u5b66\u79d1\u65b9\u5411\u53ef\u80fd\u5b8c\u5168\u4e0d\u540c\u7684\u4e13\u4e1a\u3002');
  lines.push('\u5982\u53d1\u73b0\u5019\u9009\u5217\u8868\u4e2d\u6df7\u5165\u4e86\u4e0e\u76ee\u6807\u65b9\u5411\u660e\u663e\u4e0d\u4e00\u81f4\u3001\u540d\u79f0\u76f8\u8fd1\u4f46\u5b9e\u9645\u57f9\u517b\u65b9\u5411\u4e0d\u540c\u7684\u4e13\u4e1a\uff0c');
  lines.push('\u8bf7\u5728\u56de\u7b54\u5f00\u5934\u7528\u3010\u26a0\ufe0f \u4e13\u4e1a\u540d\u79f0\u6df7\u6dc6\u63d0\u793a\u3011\u6807\u9898\u9192\u76ee\u63d0\u793a\uff0c\u5e76\u8bf4\u660e\u54ea\u4e9b\u4e13\u4e1a\u5b58\u5728\u6b64\u98ce\u9669\u3002');
  lines.push('');
  lines.push('\u8bf7\u6838\u67e5\u5f53\u5e74\u5c71\u4e1c\u62db\u751f\u8ba1\u5212\u3001\u5b66\u6821\u62db\u751f\u7ae0\u7a0b\u4e2d\u662f\u5426\u5b58\u5728\u65b0\u589e\u4e13\u4e1a\u3001\u4e13\u4e1a\u6539\u540d\u3001\u4e13\u4e1a\u5408\u5e76\u3001');
  lines.push('\u62db\u751f\u8ba1\u5212\u5927\u5e45\u53d8\u5316\u3001\u9009\u79d1\u8981\u6c42\u53d8\u5316\u7b49\u60c5\u51b5\u3002');
  lines.push('\u4e0d\u8981\u7f16\u9020\u4e0d\u5b58\u5728\u7684\u6570\u636e\uff1b\u5982\u679c\u4fe1\u606f\u4e0d\u8db3\uff0c\u8bf7\u8bf4\u660e\u9700\u8981\u8865\u5145\u4ec0\u4e48\u3002');

  return lines.join('\n');
}

function buildReportMarkdown(opts: ReportExportOptions): string {
  const { report, userProfile, getGroupData, getSchoolMeta } = opts;
  const orderedItems = getOrderedItems(report.items);
  const lines: string[] = [];

  lines.push(`# ${report.name}`);
  lines.push('');
  if (report.note) lines.push(`> ${report.note}`);
  lines.push('');
  lines.push(`- 创建时间：${new Date(report.createdAt).toLocaleString('zh-CN')}`);
  lines.push(`- 更新时间：${new Date(report.updatedAt).toLocaleString('zh-CN')}`);
  lines.push('');

  if (userProfile) {
    lines.push('## 考生基本信息');
    lines.push('');
    if (userProfile.province) lines.push(`- **省份**：${userProfile.province}`);
    if (userProfile.examYear) lines.push(`- **年份**：${userProfile.examYear}`);
    if (userProfile.subjects?.length) lines.push(`- **选科**：${userProfile.subjects.join(' + ')}`);
    if (userProfile.score) lines.push(`- **分数**：${userProfile.score} 分`);
    if (userProfile.rank) lines.push(`- **位次**：${userProfile.rank} 位`);
    if (userProfile.preferredCities?.length) lines.push(`- **偏好城市**：${userProfile.preferredCities.join('、')}`);
    if (userProfile.strategy) lines.push(`- **填报策略**：${userProfile.strategy}`);
    lines.push('');
  }

  lines.push(`## 候选项列表（共 ${orderedItems.length} 项）`);
  lines.push('');

  orderedItems.forEach((item) => {
    const group = getGroupData(item.schoolCode, item.majorCode);
    const meta = getSchoolMeta(item.schoolCode, item.schoolName);
    const rank2025 = group?.records[2025]?.minRank ?? null;
    const rank2024 = group?.records[2024]?.minRank ?? null;
    const rank2023 = group?.records[2023]?.minRank ?? null;
    const trendLabel = getTrendLabel([rank2025, rank2024, rank2023]);
    const referenceLabel = getReferenceLabel(userProfile?.rank, group?.latestRecord?.minRank ?? null);

    lines.push(`### ${item.order}. ${item.schoolName} — ${item.majorName}`);
    lines.push('');
    const basicInfo: string[] = [];
    if (meta?.city) basicInfo.push(`城市：${meta.city}`);
    if (meta?.schoolTypeTags?.length) basicInfo.push(`标签：${meta.schoolTypeTags.join(' | ')}`);
    if (basicInfo.length) lines.push(basicInfo.join('　　'));
    lines.push('');
    if (item.note) {
      lines.push(`> **我的备注**：${item.note}`);
      lines.push('');
    }
    lines.push(`**趋势标签**：${trendLabel}　　**参考标签**：${referenceLabel}`);
    lines.push('');
    lines.push('| 年份 | 最低分 | 最低位次 | 计划数 |');
    lines.push('|------|--------|----------|--------|');

    [2023, 2024, 2025].forEach(year => {
      const r = group?.records[year];
      if (r) {
        const scoreStr = r.minScore != null ? `${r.minScore}` : '官方投档表未提供';
        lines.push(`| ${year} | ${scoreStr} | ${r.minRank ?? '—'} | ${r.planCount ?? '—'} |`);
      } else {
        lines.push(`| ${year} | — | 暂无数据 | — |`);
      }
    });

    lines.push('');
  });

  lines.push('---');
  lines.push('');
  lines.push('## \u7ed9 AI \u7684\u6838\u67e5\u8981\u6c42');
  lines.push('');
  lines.push('### \u26a0\ufe0f \u4e13\u4e1a\u540d\u79f0\u6df7\u6dc6\u68c0\u67e5\u2014\u2014\u8bf7\u5728\u56de\u7b54\u5f00\u5934\u4f18\u5148\u5b8c\u6210');
  lines.push('');
  lines.push('\u8bf7\u4f18\u5148\u68c0\u67e5\u5019\u9009\u4e13\u4e1a\u540d\u79f0\u662f\u5426\u5b58\u5728\u5bb9\u6613\u6df7\u6dc6\u7684\u60c5\u51b5\u3002');
  lines.push('\u4f8b\u5982\u300c\u8f6f\u4ef6\u5de5\u7a0b\u300d\u548c\u300c\u5de5\u7a0b\u8f6f\u4ef6\u300d\u8fd9\u7c7b\u540d\u79f0\u76f8\u8fd1\u4f46\u5b66\u79d1\u65b9\u5411\u53ef\u80fd\u5b8c\u5168\u4e0d\u540c\u7684\u4e13\u4e1a\uff1b');
  lines.push('\u5982\u53d1\u73b0\u5019\u9009\u5217\u8868\u4e2d\u6df7\u5165\u4e86\u4e0e\u76ee\u6807\u65b9\u5411\u660e\u663e\u4e0d\u4e00\u81f4\u3001\u540d\u79f0\u76f8\u8fd1\u4f46\u5b9e\u9645\u57f9\u517b\u65b9\u5411\u4e0d\u540c\u7684\u4e13\u4e1a\uff0c');
  lines.push('\u8bf7\u5728\u56de\u7b54\u5f00\u5934\u7528\u3010\u26a0\ufe0f \u4e13\u4e1a\u540d\u79f0\u6df7\u6dc6\u63d0\u793a\u3011\u6807\u9898\u9192\u76ee\u63d0\u793a\uff0c\u5e76\u8bf4\u660e\u54ea\u4e9b\u4e13\u4e1a\u5b58\u5728\u6b64\u98ce\u9669\u3002');
  lines.push('');
  lines.push('\u8bf7\u6838\u67e5\u5f53\u5e74\u5c71\u4e1c\u62db\u751f\u8ba1\u5212\u3001\u5b66\u6821\u62db\u751f\u7ae0\u7a0b\u4e2d\u662f\u5426\u5b58\u5728\u65b0\u589e\u4e13\u4e1a\u3001\u4e13\u4e1a\u6539\u540d\u3001\u4e13\u4e1a\u5408\u5e76\u3001\u62db\u751f\u8ba1\u5212\u5927\u5e45\u53d8\u5316\u3001\u9009\u79d1\u8981\u6c42\u53d8\u5316\u7b49\u60c5\u51b5\u3002');
  lines.push('');
  lines.push('\u4e0d\u8981\u7f16\u9020\u4e0d\u5b58\u5728\u7684\u6570\u636e\uff1b\u5982\u679c\u4fe1\u606f\u4e0d\u8db3\uff0c\u8bf7\u8bf4\u660e\u9700\u8981\u8865\u5145\u4ec0\u4e48\u3002');

  return lines.join('\n');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
}

export function exportReportAsMarkdown(opts: ReportExportOptions): void {
  const md = buildReportMarkdown(opts);
  const safeName = sanitizeFilename(opts.report.name);
  exportTextFile(`${safeName}.md`, md, 'text/markdown');
}

export function exportReportAsTxt(opts: ReportExportOptions): void {
  const txt = buildReportText(opts);
  const safeName = sanitizeFilename(opts.report.name);
  exportTextFile(`${safeName}.txt`, txt, 'text/plain');
}

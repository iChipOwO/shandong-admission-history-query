import type { UserProfile } from '../types/user';
import type { AdmissionReport, ReportItem } from '../types/report';
import { getTrendLabel, getReferenceLabel } from './admissionAnalysis';
import { admissionRepository } from '../services/admissionRepository';
import { exportTextFile } from './exportFile';

export interface PromptOptions {
  profile?: UserProfile | null;
  reports?: AdmissionReport[];
  selectedReportId?: string | null;
  includeBaseInfo?: boolean;
  includeLabels?: boolean;
  exportCandidatesOnly?: boolean;
  includeMajorNameConfusionCheck?: boolean;
  status?: string;
}

const getOrderedItems = (items: ReportItem[] = []): ReportItem[] =>
  [...items].sort((a, b) => {
    const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

const formatValue = (value: number | null | undefined): string =>
  value == null ? '--' : String(value);

const formatHistory = (recordsByYear: Record<number, { minRank?: number | null; planCount?: number | null } | undefined>): string =>
  [2025, 2024, 2023]
    .map(year => {
      const record = recordsByYear[year];
      return `${year}年最低位次 ${formatValue(record?.minRank)}（计划 ${formatValue(record?.planCount)}）`;
    })
    .join('，');

function findReport(reports: AdmissionReport[], selectedReportId: string | null | undefined): AdmissionReport | null {
  if (!selectedReportId || selectedReportId === 'none') return null;
  return reports.find(report => report.id === selectedReportId) ?? null;
}

function findRecordsForItem(item: ReportItem, status?: string) {
  if (status !== 'ready') return [];
  return admissionRepository.getAllRecords().filter(record => {
    const schoolMatches = item.schoolCode
      ? record.schoolCode === item.schoolCode
      : record.schoolName === item.schoolName;
    const majorMatches = item.majorCode
      ? record.majorCode === item.majorCode
      : record.majorName === item.majorName;
    return schoolMatches && majorMatches;
  });
}

function appendBaseInfo(lines: string[], profile?: UserProfile | null) {
  lines.push('# 我的基本信息');
  lines.push('');
  lines.push(`* 省份：${profile?.province || '山东'}`);
  lines.push(`* 年份：${profile?.examYear || 2026}`);
  lines.push(`* 位次：${profile?.rank || '未填'}`);
  lines.push(`* 选科：${profile?.subjects?.length ? profile.subjects.join(' + ') : '未填'}`);
  lines.push('');
}

function appendReportItems(
  lines: string[],
  report: AdmissionReport | null,
  opts: {
    includeLabels: boolean;
    exportCandidatesOnly: boolean;
    profile?: UserProfile | null;
    status?: string;
  },
) {
  const title = opts.exportCandidatesOnly ? '# 报告' : '# 报告分析';
  lines.push(`${title}：${report?.name || '未选择报告'}`);
  lines.push('');

  if (!report) {
    lines.push('该报告暂无候选项');
    lines.push('');
    return;
  }

  if (report.note) {
    lines.push(`报告备注：${report.note}`);
    lines.push('');
  }

  const orderedItems = getOrderedItems(report.items);
  if (orderedItems.length === 0) {
    lines.push('该报告暂无候选项');
    lines.push('');
    return;
  }

  if (!opts.exportCandidatesOnly) {
    lines.push('报告包含以下候选项（按顺序排列）：');
    lines.push('');
  }

  orderedItems.forEach((item, index) => {
    const matched = findRecordsForItem(item, opts.status);
    const recordsByYear: Record<number, { minRank?: number | null; planCount?: number | null } | undefined> = {};
    matched.forEach(record => {
      recordsByYear[record.year] = record;
    });
    const latest = matched.length
      ? matched.reduce((prev, curr) => (curr.year > prev.year ? curr : prev))
      : null;
    const trendLabel = getTrendLabel([
      recordsByYear[2025]?.minRank ?? null,
      recordsByYear[2024]?.minRank ?? null,
      recordsByYear[2023]?.minRank ?? null,
    ]);
    const referenceLabel = getReferenceLabel(opts.profile?.rank, latest?.minRank ?? null);

    lines.push(`### 第 ${index + 1} 志愿`);
    lines.push('');
    lines.push(`* 学校：${item.schoolName}`);
    lines.push(`* 专业/专业类：${item.majorName}`);
    lines.push(`* 近三年最低位次与计划数：${formatHistory(recordsByYear)}`);
    if (opts.includeLabels) {
      lines.push(`* 趋势标签：${trendLabel}`);
      lines.push(`* 参考标签：${referenceLabel}`);
    }
    if (item.note) {
      lines.push(`* 我的备注：${item.note}`);
    }
    lines.push('');
  });
}

function appendAiRequirements(lines: string[], includeMajorNameConfusionCheck: boolean) {
  lines.push('# 给 AI 的核查要求');
  lines.push('');
  lines.push('请在联网检索状态下，基于山东“专业（专业类）+学校”的志愿模式，对上面的候选项进行客观核查。');
  lines.push('');
  lines.push('请重点完成以下任务：');
  lines.push('');
  lines.push('1. 核对每个候选项在 2026 年山东招生计划中是否仍然招生。');
  lines.push('2. 核对专业/专业类名称是否发生变化。');
  lines.push('3. 核对招生代码是否发生变化。');
  lines.push('4. 核对选科要求是否发生变化，并判断我的选科是否满足要求。');
  lines.push('5. 核对招生计划人数是否有明显变化。');
  lines.push('6. 检查是否存在新增专业、停招专业、专业拆分、专业合并或培养方向变化。');
  lines.push('7. 指出哪些候选项需要人工重点复核，并说明复核原因。');
  lines.push('8. 如果无法确认，请明确说明需要我补充哪些信息，不要编造不存在的数据。');
  lines.push('');
  lines.push('请不要进行任何形式的录取概率预测，例如录取概率、稳录、必上、保证录取等。请只提供客观的数据核查、信息一致性检查和志愿梯度合理性分析。');
  lines.push('');

  if (!includeMajorNameConfusionCheck) return;

  lines.push('# 专业名称混淆检查');
  lines.push('');
  lines.push('请优先检查候选专业名称是否存在容易混淆的情况。');
  lines.push('');
  lines.push('例如“软件工程”和“工程软件”这种名称相近却所属专业完全不同的选项，防止误报；也请注意“数学与应用数学”和“应用数学”等名称相近但口径可能不同的情况。');
  lines.push('');
  lines.push('如果发现候选列表中混入了与目标方向明显不一致、名称相近但实际培养方向不同的专业，请在回答开头用【专业名称混淆提示】标题醒目提示，并说明哪些专业存在此风险。');
  lines.push('');
}

export function buildReportAIPrompt(opts: PromptOptions): string {
  const {
    profile,
    reports = [],
    selectedReportId = 'none',
    includeBaseInfo = true,
    includeLabels = true,
    exportCandidatesOnly = false,
    includeMajorNameConfusionCheck = false,
    status,
  } = opts;

  const lines: string[] = [];
  const activeReport = findReport(reports, selectedReportId);

  if (includeBaseInfo) {
    appendBaseInfo(lines, profile);
  }

  appendReportItems(lines, activeReport, {
    includeLabels,
    exportCandidatesOnly,
    profile,
    status,
  });

  if (!exportCandidatesOnly) {
    appendAiRequirements(lines, includeMajorNameConfusionCheck);
  }

  return lines.join('\n').trimEnd();
}

export function copyAIPrompt(prompt: string, successMessage = 'Prompt 已复制到剪贴板！请粘贴至 AI 工具，并确保为其打开了联网功能。') {
  navigator.clipboard.writeText(prompt).then(() => {
    alert(successMessage);
  }).catch(() => {
    alert('复制失败，请手动选择文本复制。');
  });
}

export function exportAIPromptAsTxt(prompt: string, filename: string) {
  exportTextFile(filename, prompt, 'text/plain');
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '../types/user';
import type { AdmissionReport } from '../types/report';
import { useAdmissionData } from '../context/AdmissionDataContext';
import { buildReportAIPrompt, copyAIPrompt, exportAIPromptAsTxt } from '../utils/aiPromptBuilder';
import DisclaimerBar from '../components/DisclaimerBar';

const AIPrompt: React.FC = () => {
  const navigate = useNavigate();
  const { status } = useAdmissionData();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<AdmissionReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>('none');

  const [includeBaseInfo, setIncludeBaseInfo] = useState(true);
  const [includeLabels, setIncludeLabels] = useState(true);
  const [exportCandidatesOnly, setExportCandidatesOnly] = useState(false);
  const [includeMajorNameConfusionCheck, setIncludeMajorNameConfusionCheck] = useState(false);

  useEffect(() => {
    const savedProfile = localStorage.getItem('gaokao_user_profile');
    if (savedProfile) {
      try { setProfile(JSON.parse(savedProfile)); } catch (e) {}
    }
    const savedReports = localStorage.getItem('gaokao_reports');
    if (savedReports) {
      try {
        const reps = JSON.parse(savedReports);
        setReports(reps);
        if (reps.length > 0) {
          setSelectedReportId(reps[0].id);
        }
      } catch (e) {}
    }
  }, []);

  const generatePrompt = () => {
    return buildReportAIPrompt({
      profile,
      reports,
      selectedReportId,
      includeBaseInfo,
      includeLabels,
      exportCandidatesOnly,
      includeMajorNameConfusionCheck,
      status,
    });
  };

  const handleCopy = () => {
    copyAIPrompt(
      generatePrompt(),
      exportCandidatesOnly
        ? '候选专业信息已复制到剪贴板。'
        : 'Prompt 已复制到剪贴板！请粘贴至 AI 工具，并确保为其打开了联网功能。',
    );
  };

  const handleExport = () => {
    const prefix = exportCandidatesOnly ? '候选专业信息' : 'AIPrompt';
    exportAIPromptAsTxt(generatePrompt(), `${prefix}_${Date.now()}.txt`);
  };

  const copyButtonText = exportCandidatesOnly ? '复制候选专业信息' : '复制 AI 核查 Prompt';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '16px', marginRight: '10px' }}>&lt; 返回</button>
        <h1>生成 AI 分析 Prompt</h1>
      </header>
      <div className="page-container" style={{ flex: 1 }}>
        <div className="card">
          <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            根据您的报告候选项生成复核文本。普通模式用于复制给 AI 做联网核查；仅导出模式只复制候选专业信息，不添加任何 AI 提示词。
          </p>
          <div className="notice-bar notice-bar--info" style={{ marginBottom: '16px' }}>
            💡 部分国内 AI 疑似不支持回答相关问题，可以切换其它 AI 尝试；请为你选择的 AI 打开联网功能，这样 AI 才能进行搜索和核对。
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              对哪个报告进行分析：
              <select
                value={selectedReportId || 'none'}
                onChange={e => setSelectedReportId(e.target.value)}
                className="form-control"
                style={{ width: '220px', display: 'inline-block', fontSize: '13px' }}
              >
                <option value="none">不使用报告</option>
                {reports.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.items.length}项)</option>
                ))}
              </select>
            </label>
            {reports.length === 0 && (
              <div style={{ fontSize: '12px', color: '#b45309', marginBottom: '4px' }}>暂无报告，请先在查询结果中加入报告。</div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <input type="checkbox" checked={includeBaseInfo} onChange={e => setIncludeBaseInfo(e.target.checked)} />
              包含我的基础信息
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <input type="checkbox" checked={includeLabels} onChange={e => setIncludeLabels(e.target.checked)} />
              包含趋势与参考标签
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <input type="checkbox" checked={exportCandidatesOnly} onChange={e => setExportCandidatesOnly(e.target.checked)} />
              仅导出候选专业信息，不添加 AI 核查要求
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: exportCandidatesOnly ? '#9ca3af' : 'inherit' }}>
              <input
                type="checkbox"
                checked={includeMajorNameConfusionCheck}
                onChange={e => setIncludeMajorNameConfusionCheck(e.target.checked)}
                disabled={exportCandidatesOnly}
              />
              核对是否有引起混淆的专业名称
            </label>
          </div>

          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
            {generatePrompt()}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={handleCopy}>{copyButtonText}</button>
            <button className="btn btn-secondary" onClick={handleExport}>导出为 TXT</button>
          </div>
        </div>
      </div>
      <DisclaimerBar />
    </div>
  );
};

export default AIPrompt;

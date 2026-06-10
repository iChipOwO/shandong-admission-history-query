import React, { useState, useEffect } from 'react';
import type { AdmissionReport, ReportItem } from '../types/report';
import type { GroupedAdmission } from '../utils/admissionGrouping';
import { saveSnapshot } from '../utils/reportSnapshot';

interface ReportSelectorModalProps {
  group: GroupedAdmission;
  onClose: () => void;
}

const ReportSelectorModal: React.FC<ReportSelectorModalProps> = ({ group, onClose }) => {
  const [reports, setReports] = useState<AdmissionReport[]>([]);
  const [newReportName, setNewReportName] = useState('');
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_reports');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setReports(parsed);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveReports = (newReports: AdmissionReport[], reason: string) => {
    saveSnapshot(reports, reason);
    setReports(newReports);
    localStorage.setItem('gaokao_reports', JSON.stringify(newReports));
  };

  const handleToggleReport = (id: string) => {
    setSelectedReportIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCreateNewReport = () => {
    if (!newReportName.trim()) {
      alert('请输入新报告名称');
      return;
    }
    const newReport: AdmissionReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newReportName.trim(),
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveReports([...reports, newReport], '创建新报告');
    setNewReportName('');
    setSelectedReportIds(prev => [...prev, newReport.id]);
  };

  const handleConfirmAdd = () => {
    if (selectedReportIds.length === 0) {
      alert('请选择至少一个报告');
      return;
    }
    
    let updatedReports = [...reports];
    let changed = false;
    const targetId = `${group.schoolCode}_${group.majorCode}`;
    
    for (let i = 0; i < updatedReports.length; i++) {
      const report = updatedReports[i];
      if (selectedReportIds.includes(report.id)) {
        if (!report.items.some(item => item.id === targetId)) {
          const newItem: ReportItem = {
            id: targetId,
            schoolCode: group.schoolCode,
            schoolName: group.schoolName,
            majorCode: group.majorCode,
            majorName: group.majorName,
            order: report.items.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          updatedReports[i] = {
            ...report,
            items: [...report.items, newItem],
            updatedAt: new Date().toISOString()
          };
          changed = true;
        }
      }
    }
    
    if (changed) {
      saveReports(updatedReports, '批量添加报告项');
    }
    
    onClose();
  };

  const targetId = `${group.schoolCode}_${group.majorCode}`;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ background: 'white', borderRadius: '8px', padding: '20px', width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>添加至其它报告</h3>
        
        <div style={{ marginBottom: '20px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px' }}>
          {reports.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reports.map(r => {
                const exists = r.items.some(item => item.id === targetId);
                return (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: exists ? 'not-allowed' : 'pointer', opacity: exists ? 0.6 : 1 }}>
                    <input 
                      type="checkbox" 
                      checked={exists || selectedReportIds.includes(r.id)}
                      disabled={exists}
                      onChange={() => handleToggleReport(r.id)}
                    />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name} ({r.items.length}项)</span>
                    {exists && <span style={{ fontSize: '11px', color: '#9ca3af' }}>已存在</span>}
                  </label>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '10px' }}>暂无报告</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <input 
            type="text" 
            className="form-control" 
            placeholder="新建报告名称" 
            value={newReportName}
            onChange={e => setNewReportName(e.target.value)}
            style={{ flex: 1, padding: '8px' }}
          />
          <button className="btn btn-secondary" onClick={handleCreateNewReport} style={{ width: 'auto', padding: '8px 12px' }}>新建</button>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>取消</button>
          <button className="btn" onClick={handleConfirmAdd} style={{ flex: 1 }}>确认添加</button>
        </div>
      </div>
    </div>
  );
};

export default ReportSelectorModal;

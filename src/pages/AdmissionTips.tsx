import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DisclaimerBar from '../components/DisclaimerBar';

interface TipSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const TipSection: React.FC<TipSectionProps> = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)',
          minHeight: '52px',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '8px' }}>
          {open ? '收起 ▲' : '展开 ▼'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          {children}
        </div>
      )}
    </div>
  );
};

const AdmissionTips: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginRight: '6px', padding: '0 4px' }}>←</button>
        <h1 style={{ fontSize: '17px' }}>填报常识</h1>
      </header>
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>

        <TipSection title="🎯 1. 为什么位次比分数更重要？">
          <p>高考每年难度不同，同分数的实际含金量会变化。但全省考生的<strong>位次（排名）相对稳定</strong>。</p>
          <p style={{ marginTop: '8px' }}>高校招生本质上是从高位次向低位次录满计划数。因此：</p>
          <ul style={{ paddingLeft: '20px', marginTop: '6px' }}>
            <li><strong>填报志愿以位次为主</strong>，分数仅作辅助参考。</li>
            <li>位次数字越小，录取门槛越高。</li>
          </ul>
        </TipSection>

        <TipSection title={'📋 2. 山东\u201c专业（专业类）+学校\u201d模式'}>
          <p>山东实行新高考，志愿填报单位是<strong>"一个专业（或专业类）+ 一所学校"</strong>。</p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            <li>可以直接填报具体专业，无需专业调剂。</li>
            <li>录取即录入该专业，退档风险较低。</li>
            <li>每个志愿都要精准，不能依赖调剂兜底。</li>
          </ul>
        </TipSection>

        <TipSection title="🏫 3. 大类招生及试验班">
          <p><strong>大类招生</strong>：把几个相近专业合并为一个大类招生（如"计算机类"、"工科试验班"）。</p>
          <p style={{ marginTop: '8px', color: '#92400e', background: '#fef3c7', padding: '8px', borderRadius: '6px' }}>
            ⚠️ 大类招生通常在大一或大二后进行<strong>专业分流</strong>。大类分流通常会参考大学期间课程成绩、专业志愿、培养方案要求等，具体以学校分流规则为准。<br/>
            务必核对学校招生章程中大类包含的具体专业及分流政策。
          </p>
        </TipSection>

        <TipSection title="🌏 4. 中外合作、异地校区与高收费专业">
          <ul style={{ paddingLeft: '20px' }}>
            <li style={{ marginBottom: '10px' }}>
              <strong>中外合作办学：</strong>通常学费较高（每年可能数万元），部分专业有出国要求，且限制转入普通专业。请结合家庭预算考虑。
            </li>
            <li style={{ marginBottom: '10px' }}>
              <strong>异地校区：</strong>如"哈尔滨工业大学(威海)"、"山东大学(威海)"。毕业证通常与本部相同，但不同校区的师资、保研率、就业资源可能有差异。
            </li>
            <li>
              <strong>高收费专业：</strong>学费明显高于普通专业，填报前请确认家庭可承受范围。
            </li>
          </ul>
        </TipSection>

        <TipSection title="📝 5. 专业名称每年可能变化">
          <p>历史数据中的专业名称或选科要求可能在当年发生改变：</p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            <li>专业改名、合并、撤销</li>
            <li>选科要求变化（如从"物理"变为"物理+化学"）</li>
            <li>招生计划大幅变化</li>
          </ul>
          <p style={{ marginTop: '8px' }}>
            <strong>填报前务必核对当年《山东省普通高校招生填报志愿指南》及学校最新招生章程。</strong>
          </p>
        </TipSection>

        <TipSection title="💡 6. 关于本工具的使用建议">
          <ul style={{ paddingLeft: '20px' }}>
            <li>用历史位次数据做<strong>参考范围</strong>，不要依赖某一年的数据作为唯一判断依据。</li>
            <li>参考标签（相对稳/接近/偏冲/差距较大）是历史比较结果，<strong>不是结果承诺</strong>。</li>
            <li>建议整理候选名单后，导出 AI 分析文本，请 AI 或专业老师复核。</li>
            <li>定期导出 JSON 备份，防止浏览器缓存清除导致报告丢失。</li>
          </ul>
        </TipSection>

      </div>
      <DisclaimerBar />
    </div>
  );
};

export default AdmissionTips;

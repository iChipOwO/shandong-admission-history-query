import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Already in standalone, no need to prompt
    if (isInStandaloneMode() || Capacitor.isNativePlatform()) {
      setInstalled(true);
      return;
    }

    // Check if user already dismissed this session
    const wasDismissed = sessionStorage.getItem('pwa_install_dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
      } else {
        handleDismiss();
      }
    } catch {
      handleDismiss();
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa_install_dismissed', '1');
  };

  // Hidden states
  if (installed || dismissed) return null;

  // iOS — show manual guide link
  const ios = isIOS();

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      color: '#fff',
      position: 'relative',
    }}>
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        title="关闭"
        aria-label="关闭安装提示"
        style={{
          position: 'absolute', top: '10px', right: '10px',
          background: 'rgba(255,255,255,0.15)', border: 'none',
          borderRadius: '50%', width: '24px', height: '24px',
          cursor: 'pointer', color: '#fff', fontSize: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        ×
      </button>

      <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '15px' }}>
        📲 像 App 一样使用
      </div>
      <p style={{ fontSize: '13px', opacity: 0.9, marginBottom: '12px', lineHeight: 1.5 }}>
        安装到桌面后可更方便打开；核心数据完成缓存后可<strong>离线查询</strong>。
      </p>

      {deferredPrompt && !ios && (
        <button
          id="pwa-install-btn"
          onClick={handleInstall}
          style={{
            background: '#fff', color: '#1e3a5f',
            border: 'none', borderRadius: '8px',
            padding: '8px 18px', fontWeight: 600,
            fontSize: '14px', cursor: 'pointer',
            marginRight: '8px',
          }}
        >
          安装到桌面
        </button>
      )}

      {!deferredPrompt && !ios && (
        <p style={{ fontSize: '13px', opacity: 0.85, marginBottom: 0 }}>
          可通过浏览器菜单选择"添加到主屏幕"使用。
        </p>
      )}

      {ios && (
        <>
          <button
            onClick={() => setShowIOSGuide(!showIOSGuide)}
            style={{
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '8px', padding: '8px 16px',
              fontWeight: 500, fontSize: '13px', cursor: 'pointer',
            }}
          >
            {showIOSGuide ? '收起' : '查看安装方法'}
          </button>
          {showIOSGuide && (
            <div style={{
              marginTop: '12px', background: 'rgba(255,255,255,0.12)',
              borderRadius: '8px', padding: '10px 12px',
              fontSize: '13px', lineHeight: 1.7,
            }}>
              在 Safari 浏览器中打开本页，点击底部<strong>分享</strong>按钮（方块加箭头），
              然后选择「<strong>添加到主屏幕</strong>」即可安装。
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InstallPrompt;

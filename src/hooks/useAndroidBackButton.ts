import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useLocation, useNavigate } from 'react-router-dom';

let lastBackPressTime = 0;
let lastBackToTopTime = 0;

export function useAndroidBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backHandler: any;

    const setup = async () => {
      backHandler = await CapacitorApp.addListener('backButton', () => {
        const path = location.pathname;
        const now = Date.now();
        
        // 首页：双击退出
        if (path === '/' || path === '') {
          if (now - lastBackPressTime < 2000) {
            CapacitorApp.exitApp();
          } else {
            lastBackPressTime = now;
            showToast('再按一次返回桌面');
          }
          return;
        }

        // 指定页面：优先返回顶部
        const shouldBackToTopFirst = path.startsWith('/query') || 
                                     path.startsWith('/search-major') || 
                                     path.startsWith('/reports') || 
                                     path.startsWith('/rankings') || 
                                     path.startsWith('/subjects');

        if (shouldBackToTopFirst && window.scrollY > 120) {
          if (now - lastBackToTopTime < 2000) {
            // 2秒内连按，跳过返回顶部，直接返回上一页
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/');
            }
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            lastBackToTopTime = now;
            showToast('已返回顶部，再按一次返回上一页');
          }
          return;
        }

        // 普通返回逻辑
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/');
        }
      });
    };

    setup();

    return () => {
      if (backHandler && typeof backHandler.remove === 'function') {
        backHandler.remove();
      }
    };
  }, [location, navigate]);
}

function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.position = 'fixed';
  el.style.bottom = '100px';
  el.style.left = '50%';
  el.style.transform = 'translateX(-50%)';
  el.style.background = 'rgba(0,0,0,0.7)';
  el.style.color = 'white';
  el.style.padding = '8px 16px';
  el.style.borderRadius = '20px';
  el.style.fontSize = '14px';
  el.style.zIndex = '9999';
  el.style.pointerEvents = 'none';
  el.style.transition = 'opacity 0.3s';
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }, 2000);
}

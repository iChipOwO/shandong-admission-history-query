import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function exportTextFile(filename: string, content: string, mimeType = 'text/plain'): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      // 写入到 Cache 目录
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      // 调用分享/保存面板
      await Share.share({
        title: filename,
        url: writeResult.uri,
        dialogTitle: '保存或分享文件',
      });
      return true;
    } catch (e) {
      console.error('Filesystem/Share export failed, fallback to copy', e);
      try {
        await navigator.clipboard.writeText(content);
        alert('文件保存失败，内容已复制到剪贴板！');
        return true;
      } catch (err) {
        alert('保存失败且复制失败。');
        return false;
      }
    }
  } else {
    // 浏览器环境 fallback
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
}

export async function exportJsonFile(filename: string, data: unknown): Promise<boolean> {
  const json = JSON.stringify(data, null, 2);
  return exportTextFile(filename, json, 'application/json');
}

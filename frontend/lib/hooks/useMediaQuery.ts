/**
 * useMediaQuery Hook
 * 响应式媒体查询 Hook
 */

import { useState, useEffect } from 'react';

/**
 * 检测媒体查询是否匹配
 * @param query CSS 媒体查询字符串
 * @returns 是否匹配
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // 初始检查
    const media = window.matchMedia(query);
    setMatches(media.matches);

    // 监听变化
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/**
 * 检测是否为桌面端 (>=768px)
 * @returns 是否为桌面端
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

/**
 * 检测是否为移动端 (<768px)
 * @returns 是否为移动端
 */
export function useIsMobile(): boolean {
  return !useIsDesktop();
}

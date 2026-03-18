/**
 * Time Utility Functions
 * 时间格式化相关工具函数
 *
 * 注意：后端返回的时间格式为 SQLite 格式 (YYYY-MM-DD HH:MM:SS)，不带时区信息
 * 为避免 JavaScript Date 将其误解析为 UTC 时间，需要手动解析为本地时间
 */

/**
 * 将 SQLite 时间格式 (YYYY-MM-DD HH:MM:SS) 解析为本地 Date 对象
 * 避免 JavaScript Date 构造函数将时间误解析为 UTC
 *
 * 注意：后端存储的是本地时间，所以需要将时间字符串直接解析为本地时间，
 * 而不是让 JavaScript 将其解析为 UTC 时间后再转换。
 */
export function parseSqliteDate(dateString: string): Date {
  // 处理 ISO 格式带 Z 后缀的情况（如 2026-03-18T10:30:41.000Z）
  // 这种情况下，Z 表示 UTC 时间，但后端实际存储的是本地时间
  // 所以需要去掉 Z 并按本地时间解析
  if (dateString.endsWith('Z')) {
    // 去掉 Z 和毫秒部分，按本地时间解析
    const isoWithoutZ = dateString.replace('Z', '').replace('.000', '');
    const [datePart, timePart] = isoWithoutZ.split('T');
    if (datePart && timePart) {
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute, second] = timePart.split(':').map(Number);
      return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
    }
  }

  // 处理 ISO 格式带时区偏移的情况（如 2026-03-18T10:30:41+08:00）
  // 同样，将其视为本地时间而非 UTC 时间
  const isoWithOffsetMatch = dateString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2})$/);
  if (isoWithOffsetMatch) {
    const [, datePart, timePart] = isoWithOffsetMatch;
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
  }

  // 处理 SQLite 标准格式：YYYY-MM-DD HH:MM:SS
  const [datePart, timePart] = dateString.split(' ');
  if (!datePart || !timePart) {
    // 如果不是预期格式，尝试直接解析（兼容其他格式）
    return new Date(dateString);
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  // 使用本地时间构造函数（月份从 0 开始）
  return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
}

/**
 * 格式化时间为相对时间（如：5 分钟前、3 小时前）
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';

  const date = parseSqliteDate(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 0) return '-';
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/**
 * 格式化日期时间为本地字符串
 */
export function formatDateTime(dateString: string | null | undefined): string | undefined {
  if (!dateString) return undefined;
  return parseSqliteDate(dateString).toLocaleString('zh-CN');
}

/**
 * 格式化时间为本地字符串（格式：3 月 15 日 13:50）
 * 支持传入 t 翻译函数以支持国际化
 */
export function formatTime(dateString: string | null | undefined, t?: (key: string, fallback: string) => string): string {
  if (!dateString) return '';

  const date = parseSqliteDate(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 24 小时内显示相对时间
  if (diff < 60000) return t ? t('ui:time.justNow', '刚刚') : '刚刚';
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return t ? t('ui:time.minutesAgo', '{{minutes}} 分钟前').replace('{{minutes}}', mins.toString()) : `${mins}分钟前`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return t ? t('ui:time.hoursAgo', '{{hours}} 小时前').replace('{{hours}}', hours.toString()) : `${hours}小时前`;
  }

  // 超过 24 小时显示具体日期时间：3 月 15 日 13:50
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}月${day}日 ${hours}:${minutes}`;
}

/**
 * 计算两个时间之间的持续时间
 */
export function calculateDuration(
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined
): string {
  if (!startedAt) return '-';

  const start = parseSqliteDate(startedAt).getTime();
  const end = finishedAt ? parseSqliteDate(finishedAt).getTime() : Date.now();
  const diff = end - start;

  if (diff < 0) return '-';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

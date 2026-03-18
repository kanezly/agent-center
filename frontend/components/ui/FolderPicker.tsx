/**
 * FolderPicker Component
 * 文件夹选择器 - 用于浏览和选择本地文件夹
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { browseDirectory, type FileSystemEntry } from '@/lib/api/filesystem';

interface FolderPickerProps {
  value: string;
  onChange: (path: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

export function FolderPicker({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  error,
}: FolderPickerProps) {
  const { t } = useTranslation();
  const defaultPlaceholder = t('ui:folderPicker.placeholder', '选择文件夹路径');
  const resolvedPlaceholder = placeholder || defaultPlaceholder;
  const [isOpen, setIsOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [browsePath, setBrowsePath] = useState('Computer');

  // 打开文件夹浏览器
  const openPicker = async () => {
    if (disabled) return;

    setLoading(true);
    try {
      // 如果已有值，从该路径开始浏览
      const startPath = value || undefined;
      const result = await browseDirectory(startPath, false);
      setCurrentPath(result.current_path);
      setEntries(result.entries);
      setBrowsePath(result.current_path);
      setIsOpen(true);
    } catch (err) {
      // 如果浏览失败，从根目录开始
      try {
        const result = await browseDirectory(undefined, false);
        setCurrentPath(null);
        setEntries(result.entries);
        setBrowsePath(result.current_path);
        setIsOpen(true);
      } catch {
        // Browse failed - silently ignore
      }
    } finally {
      setLoading(false);
    }
  };

  // 进入文件夹
  const navigateTo = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const result = await browseDirectory(path, false);
      setCurrentPath(result.current_path);
      setEntries(result.entries);
      setBrowsePath(result.current_path);
    } catch {
      // Navigation failed - stay at current path
    } finally {
      setLoading(false);
    }
  }, []);

  // 返回上级
  const navigateUp = useCallback(async () => {
    if (currentPath === 'Computer' || !currentPath) return;

    // 获取父路径
    const parentPath = entries.find(e => e.name === '..')?.path;
    if (parentPath) {
      await navigateTo(parentPath);
    }
  }, [currentPath, entries, navigateTo]);

  // 选择当前文件夹
  const selectCurrentFolder = () => {
    if (currentPath && currentPath !== 'Computer') {
      onChange(currentPath);
      setIsOpen(false);
    }
  };

  // 处理条目点击
  const handleEntryClick = async (entry: FileSystemEntry) => {
    if (entry.type === 'folder') {
      if (entry.name === '..') {
        await navigateUp();
      } else {
        await navigateTo(entry.path);
      }
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        {/* 路径输入框 */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={resolvedPlaceholder}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: '14px',
            color: '#2D2926',
            backgroundColor: disabled ? 'rgba(45, 41, 38, 0.05)' : '#F9F6F1',
            border: `1px solid ${error ? '#E57373' : 'rgba(45, 41, 38, 0.1)'}`,
            borderRadius: '8px',
            outline: 'none',
            transition: 'all 150ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? '#E57373' : 'rgba(45, 41, 38, 0.25)';
            e.currentTarget.style.backgroundColor = disabled ? 'rgba(45, 41, 38, 0.05)' : '#F3EDE5';
          }}
        />

        {/* 浏览按钮 */}
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled || loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#fff',
            backgroundColor: disabled || loading ? 'rgba(45, 41, 38, 0.5)' : '#2D2926',
            border: 'none',
            borderRadius: '8px',
            cursor: disabled || loading ? 'not-allowed' : 'pointer',
            transition: 'all 150ms ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!disabled && !loading) {
              e.currentTarget.style.backgroundColor = '#4A4543';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !loading) {
              e.currentTarget.style.backgroundColor = '#2D2926';
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {t('ui:folderPicker.browse', '浏览')}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <p style={{
          marginTop: '4px',
          fontSize: '12px',
          color: '#E57373',
        }}>
          {error}
        </p>
      )}

      {/* 文件夹浏览器弹窗 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              zIndex: 9998,
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* 弹窗 */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#FFFEF9',
              borderRadius: '16px',
              padding: '20px',
              zIndex: 9999,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* 标题栏 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(45, 41, 38, 0.08)',
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#2D2926',
                margin: 0,
              }}>
                {t('ui:folderPicker.selectFolder', '选择文件夹')}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                aria-label={t('ui:actions.close', '关闭')}
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8B837B',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(45, 41, 38, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* 当前路径 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              padding: '8px 12px',
              backgroundColor: '#F9F6F1',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#5C5651',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {browsePath}
              </span>
            </div>

            {/* 文件夹列表 */}
            <div style={{
              maxHeight: '360px',
              overflow: 'auto',
              border: '1px solid rgba(45, 41, 38, 0.1)',
              borderRadius: '8px',
            }}>
              {loading ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  color: '#8B837B',
                  fontSize: '14px',
                }}>
                  {t('ui:folderPicker.loading', '加载中...')}
                </div>
              ) : entries.length === 0 ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  color: '#8B837B',
                  fontSize: '14px',
                }}>
                  {t('ui:folderPicker.emptyFolder', '此文件夹为空')}
                </div>
              ) : (
                <div>
                  {entries.map((entry) => (
                    <div
                      key={entry.path}
                      onClick={() => handleEntryClick(entry)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                        borderBottom: '1px solid rgba(45, 41, 38, 0.04)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={entry.type === 'folder' ? '#D4A574' : '#8B837B'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {entry.type === 'folder' ? (
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        ) : (
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        )}
                      </svg>
                      <span style={{
                        flex: 1,
                        fontSize: '14px',
                        color: '#2D2926',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {entry.name}
                      </span>
                      {entry.type === 'folder' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B837B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div style={{
              display: 'flex',
              gap: '10px',
              marginTop: '16px',
            }}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#5C5651',
                  backgroundColor: 'rgba(45, 41, 38, 0.08)',
                  border: '1px solid rgba(45, 41, 38, 0.15)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {t('ui:actions.cancel', '取消')}
              </button>
              <button
                type="button"
                onClick={selectCurrentFolder}
                disabled={!currentPath || currentPath === 'Computer'}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: !currentPath || currentPath === 'Computer' ? 'rgba(45, 41, 38, 0.5)' : '#2D2926',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: !currentPath || currentPath === 'Computer' ? 'not-allowed' : 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {t('ui:folderPicker.selectThisFolder', '选择此文件夹')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Decision Card Component
 * 决策项卡片 - 用于 Plan 模式的问题回答
 */

'use client';

import { useState } from 'react';

interface PlanQuestion {
  id: number;
  question: string;
  header: string;
  options: Array<{
    label: string;
    description?: string;
  }>;
  multi_select: boolean;
  user_answer?: string[];
}

interface DecisionCardProps {
  question: PlanQuestion;
  value: string[];
  onChange: (questionId: number, values: string[]) => void;
}

export function DecisionCard({ question, value, onChange }: DecisionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleOption = (optionLabel: string) => {
    if (question.multi_select) {
      // 多选：切换选项
      onChange(
        question.id,
        value.includes(optionLabel)
          ? value.filter((v) => v !== optionLabel)
          : [...value, optionLabel]
      );
    } else {
      // 单选：直接设置
      onChange(question.id, [optionLabel]);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFEF9',
        border: '1px solid rgba(45, 41, 38, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        transition: 'all 200ms ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '24px',
              padding: '0 10px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#7BB3D0',
              backgroundColor: 'rgba(123, 179, 208, 0.12)',
              borderRadius: '8px',
            }}
          >
            {question.header}
          </span>
          {question.multi_select && (
            <span
              style={{
                fontSize: '11px',
                color: '#8B837B',
              }}
            >
              (多选)
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#5C5651',
            transition: 'transform 200ms ease',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Question */}
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#2D2926',
          marginBottom: '16px',
          lineHeight: 1.5,
        }}
      >
        {question.question}
      </div>

      {/* Options */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {question.options.map((option) => {
            const isSelected = value.includes(option.label);

            return (
              <button
                key={option.label}
                type="button"
                onClick={() => toggleOption(option.label)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  width: '100%',
                  padding: '14px 16px',
                  backgroundColor: isSelected ? 'rgba(123, 179, 208, 0.08)' : 'transparent',
                  border: `2px solid ${isSelected ? '#7BB3D0' : 'rgba(45, 41, 38, 0.08)'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms ease',
                  boxShadow: isSelected ? '0 2px 4px rgba(123, 179, 208, 0.15)' : 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected
                    ? 'rgba(123, 179, 208, 0.12)'
                    : 'rgba(45, 41, 38, 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected
                    ? 'rgba(123, 179, 208, 0.08)'
                    : 'transparent';
                }}
              >
                {/* Checkbox/Radio */}
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: question.multi_select ? '6px' : '50%',
                    border: '2px solid rgba(45, 41, 38, 0.25)',
                    backgroundColor: isSelected ? '#7BB3D0' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                    transition: 'all 150ms ease',
                  }}
                >
                  {isSelected && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {question.multi_select ? (
                        <polyline points="20 6 9 17 4 12" />
                      ) : (
                        <circle cx="12" cy="12" r="3" fill="white" />
                      )}
                    </svg>
                  )}
                </div>

                {/* Option Content */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? '#2D2926' : '#5C5651',
                      marginBottom: '4px',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {option.label}
                  </div>
                  {option.description && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#8B837B',
                        lineHeight: 1.4,
                      }}
                    >
                      {option.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Count */}
      {value.length > 0 && (
        <div
          style={{
            marginTop: '14px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(45, 41, 38, 0.06)',
            fontSize: '12px',
            color: '#7BB3D0',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          已选择 {value.length} 个选项
          {question.multi_select && value.length > 0 && (
            <button
              onClick={() => onChange(question.id, [])}
              style={{
                marginLeft: 'auto',
                color: '#E57373',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              清除
            </button>
          )}
        </div>
      )}
    </div>
  );
}

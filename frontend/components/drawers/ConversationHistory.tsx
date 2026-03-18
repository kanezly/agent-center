/**
 * ConversationHistory Component
 * 对话历史组件 - 显示任务的多轮对话历史
 */

'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TaskConversation } from '@/types/task';
import type { PlanAnswerMetadata } from '@/types/plan';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { formatTime, calculateDuration } from '@/lib/utils/time';

import 'highlight.js/styles/github.css';

interface ConversationHistoryProps {
  conversations: TaskConversation[];
  currentPrompt?: string;
  currentStatus?: string;
  currentRoundNumber?: number;  // 当前对话轮次
  isPlanMode?: boolean;  // 是否为计划模式
}

export function ConversationHistory({
  conversations,
  currentPrompt,
  currentStatus,
  currentRoundNumber,
  isPlanMode = false,
}: ConversationHistoryProps) {
  const { t } = useTranslation();

  if (conversations.length === 0 && !currentPrompt) {
    return null;
  }

  // 判断是否有待处理的追加指令（当前 prompt 不在 conversations 中）
  const hasPendingPrompt = currentPrompt && currentRoundNumber !== undefined && currentRoundNumber > conversations.length;

  // 任务已取消/失败/完成时，不显示"正在思考中"或"执行中"状态
  const isTerminalState = currentStatus === 'cancelled' || currentStatus === 'failed' || currentStatus === 'completed';

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#2D2926',
          marginBottom: '12px',
        }}
      >
        {`${t('ui:conversationHistory.title', '对话历史')} (${t('ui:conversationHistory.round', '{{round}}轮', { round: conversations.length })})`}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {conversations.map((conv, index) => {
          // 检测是否为计划答案类型的对话
          const isPlanAnswer = isPlanMode && conv.metadata_parsed?.type === 'plan_answer';

          if (isPlanAnswer) {
            return (
              <PlanAnswerRound
                key={conv.id}
                conversation={conv}
                metadata={conv.metadata_parsed!}
                roundNumber={conv.round_number}
              />
            );
          }

          return (
            <ConversationRound
              key={conv.id}
              conversation={conv}
              roundNumber={conv.round_number}
              isLast={index === conversations.length - 1}
              isTerminalState={isTerminalState}
            />
          );
        })}

        {/* 当前正在执行的轮次 */}
        {hasPendingPrompt && currentStatus === 'running' && !isTerminalState && (
          <div
            style={{
              backgroundColor: '#E8F4F8',
              borderRadius: '12px',
              padding: '12px 16px',
              border: '2px dashed #7BB3D0',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#7BB3D0',
                }}
              >
                👤 {t('ui:conversationHistory.roundInstruction', '第{{round}}轮指令', { round: currentRoundNumber })} ({t('ui:status.running', '执行中...')})
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#7CB882',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    backgroundColor: '#7CB882',
                    borderRadius: '50%',
                    animation: 'pulse 2s infinite',
                  }}
                />
                {t('ui:conversationHistory.needReviewOrContinue', '需要检视或追加指令')}
              </span>
            </div>
            <p
              style={{
                fontSize: '14px',
                color: '#2D2926',
                lineHeight: 1.6,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            >
              {currentPrompt}
            </p>
          </div>
        )}

        {/* 当前正在 reviewing 的轮次（尚未批准） */}
        {hasPendingPrompt && currentStatus === 'reviewing' && (
          <div
            style={{
              backgroundColor: '#F3EDE5',
              borderRadius: '12px',
              padding: '12px 16px',
              border: '2px solid #D4A574',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#D4A574',
                }}
              >
                👤 {t('ui:conversationHistory.roundInstruction', '第{{round}}轮指令', { round: currentRoundNumber })} ({t('ui:conversationHistory.waitingReview', '等待检视')})
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: '#8B837B',
                }}
              >
                {t('ui:conversationHistory.needReviewOrContinue', '需要检视或追加指令')}
              </span>
            </div>
            <p
              style={{
                fontSize: '14px',
                color: '#2D2926',
                lineHeight: 1.6,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            >
              {currentPrompt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationRoundProps {
  conversation: TaskConversation;
  roundNumber: number;
  isLast: boolean;
  isTerminalState?: boolean;
}

function ConversationRound({ conversation, roundNumber, isLast, isTerminalState = false }: ConversationRoundProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasResult = conversation.result_text && conversation.result_text.length > 0;

  // 如果是最后一轮对话，任务已终止，且没有结果，则不显示任何内容（不显示"正在思考中"）
  const shouldShowThinking = isLast && !hasResult && !isTerminalState;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* 用户指令 */}
      <div
        style={{
          backgroundColor: '#F3EDE5',
          borderRadius: '12px',
          padding: '12px 16px',
          alignSelf: 'flex-end',
          maxWidth: '90%',
          marginLeft: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#D4A574',
            }}
          >
            👤 {t('ui:conversationHistory.roundInstruction', '第{{round}}轮指令', { round: roundNumber })}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {conversation.session_id && (
              <span
                style={{
                  fontSize: '10px',
                  color: '#8B837B',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100px',
                }}
                title={`Session: ${conversation.session_id}`}
              >
                ID: {conversation.session_id.slice(0, 8)}...
              </span>
            )}
            <span
              style={{
                fontSize: '11px',
                color: '#8B837B',
              }}
            >
              {formatTime(conversation.created_at, t)}
            </span>
          </div>
        </div>
        <p
          style={{
            fontSize: '14px',
            color: '#2D2926',
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}
        >
          {conversation.user_prompt}
        </p>
      </div>

      {/* Claude 回复 */}
      {hasResult ? (
        <div
          style={{
            backgroundColor: '#F9F6F1',
            borderRadius: '12px',
            padding: '12px 16px',
            alignSelf: 'flex-start',
            maxWidth: '90%',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#7BB3D0',
              }}
            >
              🤖 {t('ui:conversationHistory.claudeReply', 'Claude 回复')}
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {conversation.session_id && (
                <span
                  style={{
                    fontSize: '10px',
                    color: '#8B837B',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100px',
                  }}
                  title={`Session: ${conversation.session_id}`}
                >
                  ID: {conversation.session_id.slice(0, 8)}...
                </span>
              )}
              <span
                style={{
                  fontSize: '11px',
                  color: '#8B837B',
                }}
              >
                {t('ui:conversationHistory.duration', '耗时')}：{calculateDuration(conversation.started_at, conversation.finished_at)}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: '#8B837B',
                }}
              >
                {t('ui:conversationHistory.cost', '成本')}：${conversation.cost_usd?.toFixed(4) ?? '0.0000'}
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: '14px',
              color: '#2D2926',
              lineHeight: 1.6,
              maxHeight: expanded ? 'none' : '150px',
              overflow: expanded ? 'visible' : 'hidden',
              position: 'relative',
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                p: (props) => <p style={{ fontSize: '14px', color: '#2D2926', lineHeight: 1.8, marginBottom: '10px' }} {...props} />,
                code: (props: any) => {
                  if (props.className) {
                    return <code style={{ fontSize: '13px', backgroundColor: '#F3EDE5', padding: '2px 6px', borderRadius: '4px', fontFamily: 'JetBrains Mono, monospace' }} {...props} />;
                  }
                  return <code style={{ fontSize: '13px', backgroundColor: '#F3EDE5', padding: '2px 6px', borderRadius: '4px', fontFamily: 'JetBrains Mono, monospace' }} {...props} />;
                },
                pre: (props) => (
                  <pre
                    style={{
                      margin: '12px 0',
                      padding: '12px',
                      backgroundColor: '#2D2926',
                      borderRadius: '8px',
                      overflow: 'auto',
                    }}
                  >
                    {props.children}
                  </pre>
                ),
              }}
            >
              {conversation.result_text}
            </ReactMarkdown>
            {/* 渐变遮罩 - 未展开时显示 */}
            {!expanded && conversation.result_text && conversation.result_text.length > 100 && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50px',
                background: 'linear-gradient(to bottom, transparent, #F9F6F1)',
                pointerEvents: 'none',
              }} />
            )}
          </div>
          {conversation.result_text && conversation.result_text.length > 100 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                marginTop: '8px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#7BB3D0',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {expanded ? t('ui:actions.collapse', '收起') : t('ui:actions.expand', '展开更多')}
            </button>
          )}
        </div>
      ) : shouldShowThinking ? (
        <div
          style={{
            backgroundColor: '#F9F6F1',
            borderRadius: '12px',
            padding: '12px 16px',
            alignSelf: 'flex-start',
            maxWidth: '90%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid #7BB3D0',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span
            style={{
              fontSize: '13px',
              color: '#8B837B',
            }}
          >
            {t('ui:conversationHistory.claudeThinking', 'Claude 正在思考中...')}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// PlanAnswerRound Component
// ============================================================================

interface PlanAnswerRoundProps {
  conversation: TaskConversation;
  metadata: PlanAnswerMetadata;
  roundNumber: number;
}

function PlanAnswerRound({ conversation, metadata, roundNumber }: PlanAnswerRoundProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const questionsCount = metadata.questions.length;
  const shouldShowExpandButton = questionsCount > 3;

  return (
    <div
      style={{
        backgroundColor: '#F0F7FF',
        borderRadius: '12px',
        padding: '12px 16px',
        border: '1px solid rgba(123, 179, 208, 0.2)',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#7BB3D0',
        }}>
          📋 {t('ui:conversationHistory.roundInstruction', '第{{round}}轮 - 问题确认', { round: roundNumber })}
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
        }}>
          <span style={{
            fontSize: '11px',
            color: '#8B837B',
          }}>
            {formatTime(conversation.created_at, t)}
          </span>
          {conversation.cost_usd !== undefined && conversation.cost_usd > 0 && (
            <span style={{
              fontSize: '11px',
              color: '#8B837B',
            }}>
              {t('ui:conversationHistory.cost', '成本')}：${conversation.cost_usd.toFixed(4)}
            </span>
          )}
        </div>
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: expanded ? 'none' : '300px',
        overflow: expanded ? 'visible' : 'hidden',
        position: 'relative',
      }}>
        {metadata.questions.map((q, i) => {
          // 在未展开状态下，只渲染前 3 个问题（如果未展开）
          if (!expanded && i >= 3) return null;

          return (
            <div
              key={i}
              style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#2D2926',
                marginBottom: '6px',
              }}>
                ❓ {q.header}
              </div>
              <div style={{
                fontSize: '13px',
                color: '#5C5651',
                marginBottom: '8px',
                lineHeight: 1.5,
              }}>
                {q.question}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#7CB882',
                fontWeight: 500,
              }}>
                ✅ {t('ui:conversationHistory.yourAnswer', '您的选择')}：{q.answer.join(', ')}
              </div>
            </div>
          );
        })}
      </div>
      {!expanded && shouldShowExpandButton && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'linear-gradient(to bottom, transparent, #F0F7FF)',
          pointerEvents: 'none',
        }} />
      )}
      {shouldShowExpandButton && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: '12px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#7BB3D0',
            backgroundColor: 'rgba(123, 179, 208, 0.08)',
            border: '1px solid rgba(123, 179, 208, 0.2)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 150ms ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(123, 179, 208, 0.08)';
          }}
        >
          {expanded ? t('ui:actions.collapse', '收起') : t('ui:actions.expand', '展开更多') + ` (${questionsCount} ${t('ui:conversationHistory.questions', '个问题')})`}
        </button>
      )}
    </div>
  );
}


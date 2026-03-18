# 任务输入重构完成 - 高级选项终极形态

## 重构时间
2026-03-10

## 核心洞察

**"高级选项"本身就是错误的设计**

问题根源：
- 把任务属性隐藏在"设置"图标后面
- 用户需要额外点击才能看到配置
- 增加了认知负担和操作步骤

## 新范式：任务输入即配置

### 设计理念

配置不应该隐藏，应该**与输入融为一体**。

### 重构内容

#### 1. 新增组件

**`TaskConfigBar.tsx`** - 内联配置栏
- 4 个配置选项横向排列
- 项目选择器（文件夹图标）
- 依赖选择器（显示数量 Badge）
- 上下文选择器（已完成任务）
- 隔离开关（36x20px 极简 Toggle）

**`SimplePopover.tsx`** - 极简弹出列表
- 无标题，纯列表内容
- 点击外部关闭
- ESC 键关闭
- Fixed 定位，自适应位置

#### 2. 修改组件

**`TaskInput.tsx`**
- 移除 `AdvancedOptionsModal` 集成
- 移除 `PillBadge` 摘要显示
- 移除设置图标按钮
- 集成 `TaskConfigBar` 作为内联配置栏
- 保留执行/计划模式切换器

#### 3. 废弃组件

- `AdvancedOptionsModal.tsx` - 不再使用（保留但废弃）
- `AdvancedOptionsBottomSheet.tsx` - 已废弃
- `ModernToggle.tsx` - 不再使用（保留但废弃）
- `Tooltip.tsx` - 不再使用（保留但废弃）

### 界面对比

#### 旧设计（隐藏式）
```
┌─────────────────────────────────┐
│  输入框...                      │
│  [项目 ▼] [执行/计划]    [⚙️]   │  ← 配置藏在设置里
└─────────────────────────────────┘
```

#### 新设计（内联式）
```
┌─────────────────────────────────┐
│  [项目 ▼] [依赖 2 ▼] [上下文 ▼] [⚡隔离] │  ← 配置即输入
│  ─────────────────────────────────────  │
│  输入框...                              │
│  [执行/计划]                            │
└─────────────────────────────────┘
```

### 交互优化

| 操作 | 旧设计点击次数 | 新设计点击次数 |
|------|----------------|----------------|
| 查看当前配置 | 2 次（开 modal） | 0 次（始终可见） |
| 添加依赖任务 | 3 次（开 modal→展开→选择） | 1 次（直接选择） |
| 切换隔离 | 2 次（开 modal→切换） | 1 次（直接点击） |
| 移除配置 | 2 次（开 modal→移除） | 1 次（直接点击） |

### 人因工程应用

**Fitts 定律**
- 配置项就在输入框上方，距离最短
- 整个选项都是可点击区域（target area 大）

**希克定律**
- 每次只显示一个 Popover
- 选项列表有限（最多 10 个进行中任务）

**格式塔原理**
- 配置栏与输入框用分隔线区分（共同区域）
- 相关选项（项目/依赖/上下文/隔离）靠近排列（接近性）

### 视觉规范

**配置栏**
- 背景：transparent
- 分隔：底部 1px `var(--border-subtle)`
- 选项间距：8px
- 内边距：6px 10px

**选项状态**
- 默认：`var(--text-muted)` + 图标
- Hover：`var(--bg-secondary)` → `var(--bg-tertiary)`
- Active：`var(--text-primary)` + `var(--bg-secondary)`
- Badge：`#8B7D6B` 背景，白色数字

**Popover**
- 宽度：240-280px
- 最大高度：400px
- 阴影：`0 4px 12px rgba(45, 41, 38, 0.1)`
- 圆角：12px
- 边框：`1px solid var(--border-subtle)`

**Toggle**
- 尺寸：36x20px
- 开启：`#8B7D6B` 背景
- 关闭：`var(--border-visible)` 背景
- 旋钮：16px 白色圆形，带阴影

### 代码结构

```tsx
// TaskInput.tsx 简化结构
export function TaskInput() {
  // 状态
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [dependsOnTaskIds, setDependsOnTaskIds] = useState([]);
  const [forkFromTaskId, setForkFromTaskId] = useState(null);
  const [isIsolated, setIsIsolated] = useState(false);

  return (
    <div>
      {/* 配置栏 - 内联显示，始终可见 */}
      <TaskConfigBar
        projectId={selectedProjectId}
        dependsOnTaskIds={dependsOnTaskIds}
        forkFromTaskId={forkFromTaskId}
        isIsolated={isIsolated}
        // handlers...
      />

      {/* 输入框 */}
      <input placeholder="..." />

      {/* 模式切换 */}
      <SegmentedControl options={['执行', '计划']} />
    </div>
  );
}
```

### 验证标准

✅ **一眼看懂** - 用户不需要思考"高级选项"是什么
✅ **一步到位** - 任何配置最多一次点击
✅ **视觉静止** - 没有动画分散注意力
✅ **内容为主** - UI 元素退居幕后

### 后续优化建议

1. **响应式适配**
   - 移动端可考虑将配置栏改为横向滚动
   - 或堆叠为两行显示

2. **键盘导航**
   - 添加 Arrow Keys 导航 Popover 选项
   - Enter/Space 选择

3. **搜索功能**
   - 任务数量多时，Popover 内可添加搜索框

4. **状态持久化**
   - 将用户常用的配置（如隔离模式）持久化到 localStorage

### 文件清单

**新建**
- `components/ui/TaskConfigBar.tsx`
- `components/ui/SimplePopover.tsx`

**修改**
- `components/ui/TaskInput.tsx`
- `components/ui/index.ts`
- `app/globals.css` (添加 Toggle 变量)

**废弃（保留但不使用）**
- `components/ui/AdvancedOptionsModal.tsx`
- `components/ui/AdvancedOptionsBottomSheet.tsx`
- `components/ui/ModernToggle.tsx`
- `components/ui/Tooltip.tsx`

---

## 已知问题

以下 TypeScript 错误与本次重构无关，是项目已存在的问题：

```
components/drawers/ConversationHistory.tsx(59,51): metadata_parsed error
components/drawers/ConversationHistory.tsx(66,32): metadata_parsed error
components/drawers/ConversationHistory.tsx(462,36): PlanAnswerMetadata error
components/drawers/ConversationHistory.tsx(510,34): implicit any error
components/ui/DependencySelector.tsx: type mismatch errors
components/ui/PillBadge.tsx: bgSubtle property error
```

---

**完成时间**：2026-03-10
**重构风格**：Configuration as Input (配置即输入)

---

## 更新日志 - 提示文本优化

### 2026-03-10 下午 - 优化提示文本（参考之前 commit）

参考 `AdvancedOptionsModal.tsx` 中的原始提示内容，更新为：

#### 依赖任务 Popover 提示区
```
┌───────────────────────────────────────────┐
│ 依赖任务                                  │
│ 选择未完成的任务作为前置依赖，            │
│ 新任务会等待依赖任务完成后再执行。        │
├───────────────────────────────────────────┤
│ ☐ 任务 1...                        [运行中] │
│ ☐ 任务 2...                        [排队中] │
└───────────────────────────────────────────┘
```

#### 上下文 Popover 提示区
```
┌───────────────────────────────────────────┐
│ 继承上下文                                │
│ 选择已完成的任务继承其对话上下文，        │
│ 新任务将延续之前任务的对话内容。          │
├───────────────────────────────────────────┤
│ ◉ 任务 1...                        [已完成] │
│ ○ 任务 2...                        [已完成] │
└───────────────────────────────────────────┘
```

#### 隔离开关 Tooltip
- **触发方式**：Hover 显示（带 Info 图标提示）
- **定位方式**：Fixed 定位，z-index 9999，确保始终显示
- **内容**：`在 Git worktree 隔离环境中执行任务，每个任务在独立的工作目录中运行，适合需要修改文件且避免冲突的场景。`
- **位置**：Toggle 正下方，带小三角指向

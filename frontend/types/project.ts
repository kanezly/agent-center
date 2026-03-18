/**
 * Project Types for AgentCenter
 */

export interface Project {
  id: number;
  name: string;           // 项目名称（用于目录名）
  display_name?: string;  // 显示名称
  description?: string;   // 项目描述
  path: string;           // 本地绝对路径
  main_branch?: string;   // 主分支名（main/master）
  created_at: string;
  is_git?: boolean;  // 新增：是否为 Git 项目
}

export interface ProjectCreateRequest {
  name: string;
  path: string;
  display_name?: string;
  description?: string;
}

export interface ProjectUpdateRequest {
  display_name?: string;
  description?: string;
  main_branch?: string;
}

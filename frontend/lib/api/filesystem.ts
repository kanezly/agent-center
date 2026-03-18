/**
 * Filesystem API utilities
 */

import { API_BASE_URL } from './client';

export interface FileSystemEntry {
  name: string;
  path: string;
  type: 'folder' | 'file';
  size?: number;
  modified?: string;
}

export interface FileSystemListResponse {
  current_path: string;
  parent_path: string | null;
  entries: FileSystemEntry[];
}

export interface PathValidationResult {
  valid: boolean;
  path: string;
  error?: string;
  is_git?: boolean;
  exists?: boolean;
  is_directory?: boolean;
}

/**
 * Browse a directory and return its contents
 */
export async function browseDirectory(
  path?: string,
  showFiles = false
): Promise<FileSystemListResponse> {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  if (showFiles) params.set('show_files', 'true');

  const response = await fetch(`${API_BASE_URL}/api/filesystem/browse?${params}`);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to browse directory: ${error}`);
  }
  return response.json();
}

/**
 * Validate a path
 */
export async function validatePath(
  path: string,
  requireGit = false
): Promise<PathValidationResult> {
  const params = new URLSearchParams({ path, require_git: String(requireGit) });
  const response = await fetch(`${API_BASE_URL}/api/filesystem/validate?${params}`);
  return response.json();
}

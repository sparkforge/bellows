import { mkdir, rmdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Workspace, HooksConfig } from '../types.js';

const execAsync = promisify(exec);

export class WorkspaceManager {
  private root: string;
  private hooks?: HooksConfig;

  constructor(config: { root: string; hooks?: HooksConfig }) {
    this.root = resolve(config.root);
    this.hooks = config.hooks;
  }

  async getOrCreateWorkspace(issueIdentifier: string): Promise<Workspace> {
    const workspaceKey = sanitizeWorkspaceKey(issueIdentifier);
    const workspacePath = join(this.root, workspaceKey);
    const createdNow = !existsSync(workspacePath);

    await mkdir(workspacePath, { recursive: true });

    if (createdNow && this.hooks?.afterCreate) {
      await this.runHook('after_create', this.hooks.afterCreate, workspacePath);
    }

    return {
      path: workspacePath,
      workspaceKey,
      createdNow,
    };
  }

  async prepareForRun(workspacePath: string): Promise<void> {
    if (this.hooks?.beforeRun) {
      await this.runHook('before_run', this.hooks.beforeRun, workspacePath);
    }
  }

  async cleanupAfterRun(workspacePath: string): Promise<void> {
    if (this.hooks?.afterRun) {
      await this.runHook('after_run', this.hooks.afterRun, workspacePath);
    }
  }

  async removeWorkspace(issueIdentifier: string): Promise<void> {
    const workspaceKey = sanitizeWorkspaceKey(issueIdentifier);
    const workspacePath = join(this.root, workspaceKey);

    if (!existsSync(workspacePath)) {
      return;
    }

    if (this.hooks?.beforeRemove) {
      await this.runHook('before_remove', this.hooks.beforeRemove, workspacePath);
    }

    // Recursively remove directory
    await rmdir(workspacePath, { recursive: true });
  }

  private async runHook(name: string, script: string, cwd: string): Promise<void> {
    const timeoutMs = this.hooks?.timeoutMs ?? 60000;
    
    try {
      const { stdout, stderr } = await execAsync(script, {
        cwd,
        timeout: timeoutMs,
        env: { ...process.env, BELLOWS_HOOK: name },
      });
      
      if (stdout) console.log(`[${name}] stdout:`, stdout.trim());
      if (stderr) console.error(`[${name}] stderr:`, stderr.trim());
    } catch (error) {
      throw new Error(`Hook ${name} failed: ${error}`);
    }
  }
}

function sanitizeWorkspaceKey(identifier: string): string {
  return identifier.replace(/[^a-zA-Z0-9._-]/g, '_');
}

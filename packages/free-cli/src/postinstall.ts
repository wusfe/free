import fs from 'fs';
import path from 'path';
import { detectShell, getCurrentShell, upsertManagedBlock, getAllShellConfigFiles, SHELL_CONFIG_PATHS } from './shell';

function installHook(): void {
  const shellType = detectShell();
  const shellInfo = getCurrentShell();
  const { functionCode } = shellInfo;

  const configFiles = getAllShellConfigFiles(shellType);
  const allCandidates = SHELL_CONFIG_PATHS[shellType] || SHELL_CONFIG_PATHS.bash;

  if (!allCandidates || allCandidates.length === 0) {
    console.error('[free] Could not detect shell configuration file');
    console.error('[free] Please manually run: free env hook');
    return;
  }

  try {
    let installed = 0;
    const filesToProcess = configFiles.length > 0 ? configFiles : [allCandidates[0]];

    for (const configFile of filesToProcess) {
      fs.mkdirSync(path.dirname(configFile), { recursive: true });

      let content = '';
      if (fs.existsSync(configFile)) {
        content = fs.readFileSync(configFile, 'utf8');
      }

      const result = upsertManagedBlock(content, functionCode);
      if (result.changed) {
        fs.writeFileSync(configFile, result.content, 'utf8');
        installed++;
        console.log(`[free] Hook installed to: ${configFile}`);
      }
    }

    if (installed > 0) {
      console.log('[free] Shell hook installed. Restart your terminal or run "source <config-file>".');
    }
  } catch (err: any) {
    console.error(`[free] Error installing hook: ${err.message}`);
  }
}

installHook();

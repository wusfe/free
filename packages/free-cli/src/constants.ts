import path from 'path';
import os from 'os';

export const CMD_NAME = 'free';
export const ENV_PREFIX = 'FREE_CURRENT_CONFIG';
export const CONFIG_FILE = path.join(os.homedir(), '.free', 'model.json');
export const LEGACY_CONFIG_FILE = path.join(os.homedir(), '.free.json');

export const MARKER_START = `# >>> ${CMD_NAME}-env manager >>>`;
export const MARKER_END = `# <<< ${CMD_NAME}-env manager <<<`;

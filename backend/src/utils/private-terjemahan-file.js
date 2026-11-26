import fs from 'fs';
import path from 'path';

const PRIVATE_RESULTS_ROOT = path.resolve('private_uploads', 'terjemahan-hasil');

export const resolvePrivateHasilPath = (storedPath) => {
  if (typeof storedPath !== 'string' || !storedPath) return null;

  const filePath = path.resolve(storedPath);
  const relativePath = path.relative(PRIVATE_RESULTS_ROOT, filePath);
  if (
    !relativePath
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
    || !fs.existsSync(filePath)
  ) {
    return null;
  }

  return filePath;
};

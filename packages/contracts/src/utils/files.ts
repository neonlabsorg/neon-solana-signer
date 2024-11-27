import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export function writeToFile(fileName: string, data: string, distPath = 'build'): void {
  try {
    const root = process.cwd();
    if (!existsSync(join(root, distPath))) {
      mkdirSync(join(root, distPath));
    }
    writeFileSync(join(root, distPath, fileName), data);
  } catch (e) {
    console.log(e);
  }
}

import { readdirSync } from 'fs';
import { join } from 'path';
import glob from 'tiny-glob';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFiles(dir: string): Promise<Array<any>> {
  try {
    console.log(dir);
    const items = await glob(`${dir}/**/*.{js,ts}`, { absolute: true });

    if (items.length === 0) {
      return [];
    }

    for (const item of items) {
      delete require.cache[require.resolve(item)];
    }

    const files = (
      await Promise.all(items.map(async (item) => await import(item)))
    ).map((file) => file.default);

    return files;
  } catch (err) {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFilesFromPath(path: string): Promise<Array<any>> {
  try {
    const dirents = readdirSync(path, { withFileTypes: true });

    if (dirents.length === 0) {
      return [];
    }

    const items = [];

    for (const item of dirents) {
      const filePath = join(path, item.name);

      if (item.isFile() && item.name.endsWith('.js')) {
        items.push(filePath);
      } else if (item.isDirectory()) {
        items.push(...(await getFilesFromPath(filePath)));
      }
    }

    const files = (
      await Promise.all(items.map(async (item) => await import(item)))
    ).map((file) => file.default);

    return files;
  } catch (err) {
    return [];
  }
}

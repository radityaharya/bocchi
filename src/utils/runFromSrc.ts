export const runFromSrc =
  process.argv.some((arg) => arg.includes('ts-node')) ||
  process.env.NODE_ENV === 'development' ||
  process.env.BUN ||
  false;

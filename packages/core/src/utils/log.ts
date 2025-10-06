export function log(...args: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
}

export function logJson(obj: any) {
  log(JSON.stringify(obj, null, 2));
}

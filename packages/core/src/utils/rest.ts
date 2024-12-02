import { log } from './log';

export async function post<T = any>(url = '', data = {}): Promise<T> {
  log(`curl ${url} -X POST -H 'Content-Type: application/json' -d '${JSON.stringify(data)}' | jq .`);
  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    body: JSON.stringify(data)
  });
  const result = await response.text();
  if (result) {
    return JSON.parse(result);
  }
  return {} as T;
}

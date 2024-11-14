export async function post<T = any>(url = '', data = {}): Promise<T> {
  console.log(`curl -H 'Content-Type: application/json' -d '${JSON.stringify(data)}' -X POST ${url} | jq .`);
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

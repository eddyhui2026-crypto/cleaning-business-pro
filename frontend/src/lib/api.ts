const API_BASE = (
  import.meta as unknown as {
    env?: {
      VITE_API_BASE_URL?: string;
      VITE_API_URL?: string;
    };
  }
).env?.VITE_API_BASE_URL ??
  (
    import.meta as unknown as {
      env?: {
        VITE_API_URL?: string;
      };
    }
  ).env?.VITE_API_URL ??
  'https://cleanflow-backend-8ap3.onrender.com';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE.replace(/\/$/, '')}${p}`;
}

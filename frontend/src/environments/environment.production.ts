// Replaced by Angular's --define during npm run build; never put secrets here.
declare const MLP_API_BASE_URL: string;

export const environment = {
  apiBaseUrl: typeof MLP_API_BASE_URL === 'undefined' ? '/api/v1' : MLP_API_BASE_URL,
} as const;

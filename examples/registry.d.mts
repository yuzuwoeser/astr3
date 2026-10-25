export interface Example {
  id: string;
  title: string;
  build?: 'vite' | 'vue' | 'svelte' | 'angular' | 'rails';
  category: 'example' | 'browser' | 'framework' | 'server';
  description: string;
  preview: string;
  browserOnly?: boolean;
  downloads?: string[];
  files: string[];
}
export const examples: Example[];

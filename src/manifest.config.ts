import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Linear Bug Catcher',
  version: '0.1.0',
  description: 'Capture a screenshot and network logs, then file a Linear ticket without leaving the page.',
  action: {
    default_title: 'Linear Bug Catcher (Alt+Shift+B)',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage', 'tabs', 'activeTab', 'scripting', 'clipboardRead'],
  host_permissions: ['<all_urls>'],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/inject/interceptor.ts'],
      run_at: 'document_start',
      world: 'MAIN',
      all_frames: false,
    },
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.tsx'],
      run_at: 'document_start',
      world: 'ISOLATED',
      all_frames: false,
    },
  ],
  commands: {
    'open-bug-catcher': {
      suggested_key: { default: 'Alt+Shift+B' },
      description: 'Open Linear Bug Catcher',
    },
  },
})

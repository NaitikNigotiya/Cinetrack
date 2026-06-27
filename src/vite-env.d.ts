/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

import 'firebase/firestore'

declare module 'firebase/firestore' {
  export function persistentMultipleTabManager(): any
}

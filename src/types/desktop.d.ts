export {}

declare global {
  interface Window {
    packpro?: {
      isDesktop?: boolean
      quit?: () => void
      print?: () => Promise<boolean>
    }
  }
}

export type WindowMode = 'home' | 'dungeon' | 'tribulation' | 'settings'
export interface PetSnapshot { state: unknown; messages: unknown }
export interface DesktopAPI {
  isDesktop: boolean
  windowRole: 'pet' | 'game'
  petMode(): void
  gameMode(mode?: WindowMode): void
  setClickThrough(on: boolean): void
  setHitTest(interactive: boolean): void
  dragPet(dx: number, dy: number): void
  rendererReady(): void
  rendererFailed(message: string): void
  publishPetState(state: unknown, messages: unknown): void
  getPetState(): Promise<PetSnapshot | null>
  listPacks(): Promise<unknown[]>
  onPetState(cb: (snapshot: PetSnapshot) => void): () => void
  dispatchPetAction(action: unknown): void
  onPetAction(cb: (action: unknown) => void): () => void
  quit(): void
  onOpenMode(cb: (mode: WindowMode) => void): () => void
  onOpenHome(cb: () => void): () => void
  startGuard(whitelist: string[], strict: boolean): void
  stopGuard(): void
  onDistraction(cb: (app: string) => void): () => void
  onTrayAction(cb: (action: string) => void): () => void
  onMusic(cb: (on: boolean) => void): () => void
  onMusicTrack(cb: (track: string) => void): () => void
  setWander(on: boolean): void
  setFollow(on: boolean): void
  log(level: 'info' | 'warn' | 'error' | 'debug', tag: string, message: string, extra?: unknown): void
  onVerbose(cb: (on: boolean) => void): () => void
}
export const desktop = (window as unknown as { desktop?: DesktopAPI }).desktop

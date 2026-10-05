import type { Dispatch, SetStateAction } from 'react'
import type { PetState, ActionMsg, PetAction } from '../game/data'
export type ViewMode = 'pet' | 'home' | 'dungeon' | 'tribulation' | 'settings'
export interface ViewProps {
  pet: PetState
  messages: ActionMsg[]
  dispatch: (action: PetAction) => void
  setMessages: Dispatch<SetStateAction<ActionMsg[]>>
  navigate: (mode: ViewMode) => void
  mode: ViewMode
}

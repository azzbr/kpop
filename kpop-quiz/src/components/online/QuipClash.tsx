import type { RoomApi, GameConfig } from '../../online/useRoom';
import { ArenaFrame, Waiting } from './ArenaParts';

// Placeholder while the game is being built.
export default function QuipClash(props: { room: RoomApi; config?: GameConfig }) {
  return <ArenaFrame key={props.room.code} title="Quip Clash" icon="🎤"><Waiting text="Coming soon" /></ArenaFrame>;
}

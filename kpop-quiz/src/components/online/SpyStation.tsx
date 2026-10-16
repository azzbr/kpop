import type { RoomApi, GameConfig } from '../../online/useRoom';
import { ArenaFrame, Waiting } from './ArenaParts';

// Placeholder while the game is being built.
export default function SpyStation(props: { room: RoomApi; config?: GameConfig }) {
  return <ArenaFrame key={props.room.code} title="Spy Station" icon="🕵️‍♀️"><Waiting text="Coming soon" /></ArenaFrame>;
}

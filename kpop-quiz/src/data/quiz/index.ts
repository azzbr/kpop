import type { QuizBank } from './types';
import { generalKnowledge } from './generalKnowledge';
import { scienceSpace } from './scienceSpace';
import { geography } from './geography';
import { animals } from './animals';
import { sportGames } from './sportGames';
import { trueOrFalse } from './trueOrFalse';
import { orderIt } from './orderIt';
import { halloween } from './halloween';

export const QUIZ_BANKS: QuizBank[] = [
  generalKnowledge,
  scienceSpace,
  geography,
  animals,
  sportGames,
  trueOrFalse,
  orderIt,
  halloween,
];

export function getBank(id: string): QuizBank | undefined {
  return QUIZ_BANKS.find(b => b.id === id);
}

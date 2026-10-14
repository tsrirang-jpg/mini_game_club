import { describe, expect, it } from 'vitest';
import { compare, evaluate, makeLedger, applyLedger } from '../packages/shared/src/index';
import type { Card, Suit } from '../packages/shared/src/index';
const c = (rank: number, suit: Suit = 'clubs'): Card => ({ rank, suit });
describe('Restored Pok Deng table rules', () => {
  it('compares Pok before scores while a three-card nine never becomes Pok', () => {
    expect(compare(evaluate([c(8), c(13, 'hearts')]), evaluate([c(2), c(3, 'hearts'), c(4, 'spades')]))).toBe(1);
    expect(compare(evaluate([c(8), c(13, 'hearts')]), evaluate([c(9), c(12, 'hearts')]))).toBe(-1);
  });
  it('uses only the original pair/two-suited/three-suited multipliers', () => {
    expect(evaluate([c(7), c(7, 'hearts')]).multiplier).toBe(2);
    expect(evaluate([c(1), c(2)]).multiplier).toBe(2);
    expect(evaluate([c(1), c(4), c(7)]).multiplier).toBe(3);
  });
  it('does not award extra multipliers or priority to trips, face cards or straights', () => {
    for (const hand of [[c(7),c(7,'hearts'),c(7,'spades')], [c(11),c(12,'hearts'),c(13,'spades')], [c(1),c(2,'hearts'),c(3,'spades')]]) {
      expect(evaluate(hand).multiplier).toBe(1);
      expect(compare(evaluate(hand),evaluate([c(7),c(13,'hearts')]))).toBe(-1);
    }
  });
  it('ties equal non-Pok scores even when a multiplier differs', () => {
    expect(compare(evaluate([c(1),c(2)]),evaluate([c(1),c(2,'hearts')]))).toBe(0);
    expect(compare(evaluate([c(7),c(7,'hearts')]),evaluate([c(1),c(3,'spades')]))).toBe(0);
  });
  it('settles the winner multiplier and conserves points exactly once', () => {
    const {ledger,results}=makeLedger(1,'d',{d:[c(2),c(3,'hearts')],p:[c(9),c(13)],q:[c(1),c(2)]},{p:10,q:50});
    expect(results.find(r=>r.id==='p')?.delta).toBe(20);
    expect(results.find(r=>r.id==='q')?.delta).toBe(-50);
    const settled=new Set<number>();const balances=applyLedger({d:1000,p:1000,q:1000},ledger,settled);
    expect(Object.values(balances).reduce((a,b)=>a+b,0)).toBe(3000);
    expect(applyLedger(balances,ledger,settled)).toEqual(balances);
  });
});

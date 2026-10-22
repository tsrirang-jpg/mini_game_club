# Joining while a round is running

All seven multiplayer games accept human joins while playing, subject to the existing room/player limit. Poker room closure still blocks joins. Road Fighter is single player and has no room flow.

## Membership and privacy

- packages/shared/src/room.ts defines optional waiting membership, round boundaries and promotion helpers. A join during active play reserves a seat with waiting=true; the game does not deal or assign a secret to that seat.
- The server rejects gameplay, chat and votes from waiters during the running round. They do not affect the current turn, majority, team composition, payouts, winner lists or deadlines. Removing a waiting seat frees capacity immediately, without removing any active player's dealt hand.
- Ordinary sync/reconnect restores the same waiting membership. Poker/Pokdeng/Old Maid/Liar sync an empty hand, Spyfall syncs a null role, Who am I syncs an empty identity list, and Undercover syncs a null word.
- Preparing the next round promotes waiters into the lobby; they press Ready like other players. Who am I also promotes them when the host starts the next game in the current multi-game set. Round start helpers cover direct start-from-results paths as well.

## Shared UI

GameScreen renders RoundWaitingRoom for the waiting user, with the game's existing theme, room code/copy, public round status, roster and exit. It returns to the game screen automatically when membership is promoted. The current players see WaitingQueueButton and can inspect the queue. Their gameplay snapshot excludes waiting seats, so new arrivals do not change the opponent grid or game-specific counts. The session's authoritative snapshot retains every member.

The server accepts at most the existing total capacity, including waiters and bots. A full room still returns the full-room error; this is not an unlimited spectator queue. An existing reserved reconnect seat is not handed to a new joiner.

## Checks

- tests/late-join.test.ts covers private membership, action rejection, stable active state, settlement exclusion, next-round admission, capacity, withdrawal and Who am I nextGame for all seven engines.
- npm run test:late-join uses the real server and the development frontend to join during play, inspect the queue, check eight screen sizes, reload the waiting seat, prepare/ready/start, and verify the new cards or secrets. Defaults: http://127.0.0.1:5188 and ws://127.0.0.1:2567; override GAME_URL/GAME_WS when needed.
- Existing Old Maid/Undercover network tests now distinguish a full room from an active room with spare seats and verify that the latter admits a private waiting member.

# Meme Coin Detective: The On-Chain Hunt

A noir detective / reaction game set in the wild west of Solana DEX trading.

You're a degen trader with a detective's eye. Scan pseudo-generated wallet
addresses for bot/sniper transaction patterns, then ape into the coin. The
real game starts after you hit **Buy**: watch the live chart and smash
**Sell** at the perfect moment. Get greedy, and the dev rug pulls you —
your PnL craters, accompanied by a sad trombone.

## How to play

No build step, no dependencies. Just serve the folder statically and open
it in a browser, for example:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

or simply open `index.html` directly in a browser.

## Gameplay loop

1. **Case Briefing** — a new meme coin case comes in.
2. **Scan** — flag wallets showing bot-like transaction patterns (identical
   amounts, robotic timing) before the timer runs out. Good scanning earns
   you an early-warning cue later on.
3. **Buy** — ape in with your stake.
4. **Hold** — the live multiplier climbs while you decide when to sell.
   Somewhere out there, hidden, is the rug pull moment.
5. **Sell** (or get rugged) — cash out your gains, or lose your stake to a
   sad trombone.
6. Take the next case, or retire and bank your winnings. Difficulty ("heat")
   escalates the longer your streak runs.

Bankroll and best-run stats persist locally in the browser via
`localStorage`.

All audio is synthesized on the fly with the Web Audio API — no external
assets required.

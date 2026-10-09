# Azarakhsh Front V4 QA

Current requested update:
- Hypersonic terminal descent/dive is steeper and faster while boost/ascent timing remains unchanged.
- Rain carrier has a 30% SAM interception chance per eligible SAM shot before payload release.
- Public game branding remains only "Azarakhsh Front V4" in the built game.
- Language switching is temporarily disabled; the game is forced to Persian / RTL.
- Existing Offline, Online, diplomacy, production, defense, economy and other gameplay systems were preserved.

Validation performed on this build:
- JavaScript syntax: 30 passed / 0 failed.
- Engine/self tests: 74 passed / 0 failed.
- Combat regression: 37 passed / 0 failed.
- Room/server unit tests: 35 passed / 0 failed.
- Azarakhsh Front V4 focused tests: 7 passed / 0 failed.
- Browser/UI checks: 53 passed / 0 failed.
- Online-client snapshot fixture checks: 19 passed / 0 failed.
- Build completed successfully and both release HTML entry files are identical.

Network note:
- Real Socket.IO transport could not be re-run in this sandbox because npm dependencies were not available locally and package installation could not complete here.
- The authoritative room/server unit suite and online client snapshot fixture suite both passed.

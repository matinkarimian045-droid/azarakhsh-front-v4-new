# AF 2.9 Release Candidate QA

- JavaScript syntax: **29/29 passed**
- Engine/self-tests: **74/74 passed**
- Room/server unit tests: **34/34 passed**
- Chromium UI/browser checks: **53/53 passed**

Validated release changes include ballistic/hypersonic production balance, 10% SAM chance for hypersonic missiles, 0% SAM chance for rain carriers, one-click automatic factory product switching, 5-second citizen voice rotation, polished menu/settings, and full textual tutorial.

Real Socket.IO transport between two separate machines was not executed in this environment; run `npm install`, `npm run test:network`, then `npm start` on the deployment machine.

# Authentic8 NFC and QR certificates

Issue a certificate from a form, record its fingerprint on a blockchain, and open it by tapping the card's NFC chip or scanning its QR code.

- **Admin** (`/admin`): set up events, issue certificates, print QR codes, write NFC chips, revoke.
- **Certificate page** (`/c/<id>`): what a phone opens on tap or scan. It is styled after the reference templates and checks the blockchain each time it opens.

```
frontend/   React 19 + Vite 8: admin console and certificate page
backend/    Express 5 API, SQLite (node:sqlite), media store, blockchain client
backend/contracts/CertificateRegistry.sol   on-chain registry
```

## Run it

You need Node.js 24 (`nvm use 24`).

```bash
npm run setup                      # install backend and frontend
cp backend/.env.example backend/.env

# three terminals
npm run chain                      # local blockchain (Hardhat) on :8545
npm run backend                    # API on :5000; deploys the contract on first run
npm run frontend                   # UI on :5173
```

Open http://localhost:5173/admin and sign in with the password from `ADMIN_PASSWORD` (default `admin`). The sample event, *Gujarat Kabaddi Championship 2026*, is created on first start from the reference templates.

Tests: `npm test`.

### Single-server mode

`npm run build && npm start` serves the built UI from the backend, so the admin, the API and the certificate links all use one address on port 5000. This is the easiest setup for a phone demo.

## Demo: issue, tap, scan

A phone has to be able to reach the links you write to cards, and Web NFC writing only works over HTTPS. A tunnel gives you both:

```bash
npm run build && npm start
cloudflared tunnel --url http://localhost:5000     # or: ngrok http 5000
```

1. Put the tunnel URL in `backend/.env` as `PUBLIC_BASE_URL=https://….trycloudflare.com` and restart the backend.
2. On an Android phone, open `https://…/admin` in Chrome and sign in.
3. **Issue**: pick the event and role, fill in the form, add a photo, then press **Issue certificate**. The certificate is fingerprinted and recorded on the chain.
4. **Write the card**: on the certificate screen, press **Write to NFC card** and hold an NTAG213/215/216 card to the phone. You can also lock the chip so it can't be rewritten.
5. **Tap**: tap the card with any phone (iPhone or Android). The certificate opens and shows *The certificate is authenticated*.
6. **Scan**: download the QR code (PNG, or SVG for print), print it or show it on screen, and scan it with a phone camera. The same page opens.

If you aren't using Chrome on Android, write the link with an app such as NXP TagWriter or NFC Tools, then press **Mark card as written**. On the same Wi-Fi you can skip the tunnel and use `PUBLIC_BASE_URL=http://<your-LAN-IP>:5173` in dev mode. QR and tap work this way, but in-browser NFC writing doesn't, because it needs HTTPS.

## Using a public testnet

With no extra settings it runs on the local Hardhat chain. For a public chain such as Polygon Amoy, set these in `backend/.env`:

```bash
RPC_URL=https://rpc-amoy.polygon.technology
PRIVATE_KEY=0x…            # a funded testnet key used only for this
CHAIN_NAME=Polygon Amoy testnet
EXPLORER_URL=https://amoy.polygonscan.com
```

Then run `npm run deploy --prefix backend`, put the printed `CONTRACT_ADDRESS` in `.env`, and restart. The certificate page links each record to the explorer.

## Choices

**Events are data, not code.** The brief says who gets a certificate, and what it shows, changes every event. So each event is a config edited in the admin. It sets:
- the **roles** (Winner, Referee, Mentor…) and each role's finish: gold, silver, bronze, or the event colour;
- the **form fields**, each with a type, whether it's required, and where it shows (the details grid, a quote card, or recorded but never shown);
- which fields each role is asked;
- the theme colours, heading font and artwork;
- the sponsor offer, sponsors, partner logos and officials.

The five templates became one themeable page. The kabaddi look is just the seeded event's settings. A second event (for example a hackathon in teal and purple, with a Track field and a Jury) needs no code change.

**Only a fingerprint goes on-chain.** At issue time the certificate's data is frozen into a payload: the event facts, the role, the name, the field values, and the SHA-256 of every image. The payload is serialised as canonical JSON and its keccak256 hash is written to `CertificateRegistry`. Personal data stays off-chain. The certificate page re-hashes the stored record and its image files every time it opens, then compares the result with the chain. If someone edits the database or swaps a photo, the page shows *does not match*. Revoking writes to the chain too, so a lost or wrongly issued card shows as revoked.

**The registry is a small contract**, not an NFT. It stores `id → fingerprint, issuedAt, revokedAt`, lets only allow-listed issuers write, and never overwrites a record. Certificates are recorded the moment they're issued, so issuing never waits on a batch. If the chain is down, the certificate is saved as *pending* and the admin can retry.

**The NFC chip and the QR code hold the same short URL.** Any phone can open it without an app. The admin writes it with Web NFC, saves the chip's serial number, and can lock the chip. IDs are 10 random characters from an alphabet without look-alike letters, so links can't be guessed and stay readable when printed.

**Few moving parts.** The database is the SQLite built into Node 24. Images are stored under their own hash. The UI, API and certificate pages can run on one origin, and there's no build step beyond Vite.

### Limits and next steps

- **Copied cards.** A plain NTAG chip holding a URL can be copied. Hardware-bound authenticity would need NTAG 424 DNA with SUN messages: the chip signs every tap, and the server checks the signature. The data model is already set up for that, because the chip serial is saved with the certificate.
- **Admin sign-in** is one shared password with signed tokens. Real use needs per-user accounts and an audit log.
- **Local chain resets.** If you restart `npm run chain`, the local chain starts empty. The backend redeploys the contract, and certificates issued before the restart show *not found on the blockchain*. A public testnet keeps them.

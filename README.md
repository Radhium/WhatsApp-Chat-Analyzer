# WhatsApp Chat Analyzer

Upload a WhatsApp chat export and get a full breakdown of your conversation — message counts, activity patterns, response times, and streaks. No server. No sign-up. Your data never leaves your device.

---

## What it shows you

**Message counts** — who sends more, by how much, visualised as a bar chart and a table with share percentages.

**Activity patterns** — which hours of the day the chat is most active, shown as a line chart.

**Response times** — average time each person takes to reply, with fastest and slowest responder highlighted. Only gaps under 24 hours count — longer silences are not treated as slow responses.

**Streaks and silences** — longest streak of consecutive active days, current streak counting back from the last message, and the longest silence between any two messages.

---

## How to export your WhatsApp chat

**On iPhone:**

1. Open the chat in WhatsApp
2. Tap the contact or group name at the top
3. Scroll down and tap **Export Chat**
4. Choose **Without Media**
5. Save or share the `.txt` file

**On Android:**

1. Open the chat in WhatsApp
2. Tap the three-dot menu → **More** → **Export Chat**
3. Choose **Without Media**
4. Save or share the `.txt` file

Upload the `.txt` file directly — do not zip it.

---

## Running it locally

No build step. No install. Just open the files.

```
git clone https://github.com/your-username/whatsapp-chat-analyzer.git
cd whatsapp-chat-analyzer
```

Open `index.html` in your browser. That is it.

Because the app uses ES Modules, some browsers block local module imports when opening files directly from disk. If the dashboard does not load after upload, serve the folder with any static file server:

```bash
# Python (comes pre-installed on most systems)
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

---

## Tech stack

| Layer   | Tool                            | Why                                                      |
| ------- | ------------------------------- | -------------------------------------------------------- |
| Markup  | HTML5                           | Semantic, two-page architecture                          |
| Styling | Vanilla CSS                     | Handwritten, custom properties throughout — no framework |
| Logic   | Vanilla JavaScript (ES Modules) | No bundler, no dependencies, no framework                |
| Charts  | Chart.js (CDN)                  | Horizontal bar chart, line chart, activity calendar      |
| Fonts   | Inter via Google Fonts          | Single family, weights do the visual work                |
| Storage | sessionStorage                  | Parsed data passed between pages, nothing persisted      |

Vanilla JS is a deliberate choice, not a limitation. No React. No Tailwind. No build toolchain.

---

## File structure

```
whatsapp-chat-analyzer/
├── index.html        ← Upload / landing page
├── dashboard/
│   └── dashboard.html    ← Results dashboard
├── css/
│   └── style.css     ← All styles and custom properties
├── js/
│   ├── parser.js     ← Parses raw WhatsApp export text into structured data
│   ├── stats.js      ← Computes response times, streaks, and silences
│   ├── charts.js     ← Chart.js wrappers for all visualisations
│   ├── render.js     ← Populates the dashboard DOM from parsed data
│   ├── storage.js    ← sessionStorage read/write
│   └── app.js        ← Entry point — wires file upload to parse to dashboard
└── README.md
```

---

## Supported export formats

The parser handles the two most common WhatsApp timestamp formats:

- `DD/MM/YYYY, HH:MM` — standard 24-hour format (most Android and newer iOS exports)
- Group chats and one-on-one chats both work

Files over 50 MB are rejected with an error message. In practice, even very long text-only chats are well under this limit.

---

## Privacy

Everything runs in your browser. The chat file is read locally by JavaScript — it is never uploaded to any server, never sent anywhere, never stored beyond your current browser session. Closing the tab clears everything.

---

## Known limitations

- AM/PM (12-hour) timestamp format not yet supported — affects some older iOS exports
- Very large exports (50,000+ messages) may take a moment to parse — this is a browser limitation, not a bug
- Response time stats require at least 50 qualifying exchanges per person to display — smaller samples produce unreliable averages

---

## License

MIT

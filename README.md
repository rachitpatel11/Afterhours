# AFTERHOURS

## Run it (demo works immediately)
- Windows: double-click `start.bat`
- Mac/Linux: run `python3 serve.py`

It opens http://127.0.0.1:8888/ . Needs Python 3 and an internet connection (fonts, lyrics).

## Connect Spotify (one-time)
1. developer.spotify.com/dashboard -> Create app (owner needs Spotify Premium; Web API ticked).
2. Add this Redirect URI exactly: `http://127.0.0.1:8888/`
3. Settings -> User management: add your own Spotify name and email.
4. Copy the Client ID into `config.js`, save, refresh the page, press S -> Connect Spotify.

## Keys
A ambient | F fullscreen | I hide info | T theme | D demo | S settings

## Last.fm mode (works for any number of people)
1. Create a free API account at https://www.last.fm/api/account/create and paste the API key into `config.js`.
2. Each listener: on last.fm go to Settings -> Applications, connect Spotify Scrobbling.
3. In AFTERHOURS: Source -> type your Last.fm username -> Connect Last.fm.
4. Lyrics a bit off? Use the Sync button (nudges, or tap when you hear a line). Keys: [ and ]

## Going public (v7)
1. Cloudflare dashboard -> Workers & Pages -> Create -> Worker. Paste `cloudflare-worker.js`, Deploy.
2. Worker -> Settings -> Variables and Secrets: add Secret `LASTFM_KEY` = your Last.fm API key.
3. Copy the Worker address into `lastfmProxy` in `config.js`. Make sure `lastfmApiKey` is empty.
4. Delete serve.py, start.bat, start.command. Upload the folder to Netlify Drop (or Cloudflare Pages).
5. Back in the Worker add variable `ALLOW` = your site address (e.g. https://yourname.netlify.app) so only your site can use it.
6. Edit `privacy.html`: put your real contact email.

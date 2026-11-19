# Spending Tracker Bookmarks for Chrome

A standalone Manifest V3 extension. Open its toolbar popup to capture the
current page's title and URL, choose a **Bookmarks** folder (including nested
folders), optionally add a description, and save to Spending Tracker.
No npm install, build, background service, or web-app session sharing is needed.

## Install

1. Deploy the backend with the Notes `links` folder type and `url` field.
2. Open `chrome://extensions` in Chrome 120 or newer.
3. Enable **Developer mode**, choose **Load unpacked**, and select this
   `chrome-extension` directory, not the repository root.
4. Pin **Spending Tracker Bookmarks** from Chrome's Extensions menu.
5. Open the extension and enter the **App URL** and **API base URL**.
   For example, `https://tracker.example.com` and `https://api.example.com`.
   Do not append `/notes` or `/api`. Reverse-proxy base paths are supported.
6. Save the connection and approve Chrome's access request for the API origin.
7. Sign in using a **Writer** or **Admin** account.
8. Visit a website, open the popup, choose a folder, and select **Save bookmark**.
   Keep the popup open until it confirms success.

Use **Open app** to manage folders. If no folders are listed, create a folder
with type **Bookmarks** in Notes & lists, then choose **Refresh** in the popup.
Only folders of type `links` are destinations. Each folder's full parent path
is shown, including parents of other types. The destination is checked again
before saving, and bookmarks are appended after its current item positions.

After source updates, use **Reload** on the extension's Chrome management card.
There is no Chrome Web Store publication or automatic update setup in this repo.

## Connection and authentication

- Server URLs must use HTTPS. HTTP is accepted only for `localhost`,
  `127.0.0.1`, and `[::1]` development servers. Trust a development HTTPS
  certificate in Chrome before connecting; the extension never bypasses TLS.
- The API base must point at the full application, not the auth-only entry point:
  the extension needs `/api/auth/login`, `/api/note-folders/tree`, and `/api/notes`.
- Sign-in uses the existing username/password endpoint and Bearer-token contract.
  There is no refresh-token or additional MFA endpoint assumed.
- Passwords are cleared from the form after sign-in attempts and are never
  stored. Tokens are held only in `chrome.storage.session`, not local/sync
  storage. Closing the popup keeps the session; browser restart, extension
  reload, sign-out, expiration, or changing the API base requires sign-in again.
- Only non-secret app/API URL settings use `chrome.storage.local`. The last
  successfully used folder is remembered in the current authenticated session.
- Expired sessions and HTTP 401 return to sign-in without erasing the current
  popup's bookmark draft. Network/server errors are displayed and never
  automatically retried. After an interrupted or ambiguous save, check the app
  before retrying to avoid duplicate bookmarks.

## Permissions and privacy

- `activeTab`: reads only the current tab's title and URL when the popup opens.
  No browser history access, content script, page scraping, or native Chrome
  bookmark access is requested. Internal Chrome pages cannot be captured;
  enter an HTTP(S) URL manually instead.
- `storage`: saves URL settings and the session-only token.
- Optional host permissions: allow a configurable API host. The extension asks
  for the configured API origin only, not blanket access to all websites.
  Switching origins removes the old API-origin grant. The app URL is only
  opened in a tab and does not receive API credentials.
- Requests originate from the extension popup, use explicit Bearer tokens,
  omit cookies, reject redirects, and never fetch the bookmarked page.
- Bookmark URLs must be HTTP(S), without embedded credentials or whitespace.
  Folder names and server errors are rendered as text, never HTML.
- Notes remain shared among authenticated accounts under the backend's current
  data model. This extension does not add ownership isolation or change
  server authorization. Writer/Admin gating mirrors the web UI.
- Nothing is sent to analytics or third-party metadata services.

## Validation

From the repository root:

```sh
node --test chrome-extension/tests/*.test.mjs
node --check chrome-extension/core.mjs
node --check chrome-extension/popup.mjs
```

For manual Chrome integration testing, load the unpacked extension, configure a
test API, approve its permission, sign in, and save a page into a nested Bookmarks
folder. Verify the note appears in the web app with its title, URL, description,
and position. Check expired credentials, revoked host permission, a Reader
account, and a missing/deleted/converted folder.

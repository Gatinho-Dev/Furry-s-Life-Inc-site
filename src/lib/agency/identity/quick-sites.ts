/**
 * Popular platforms present in the Sherlock snapshot, used for the quick pass.
 * Ids absent from the snapshot are ignored at runtime, so the list is safe to extend.
 */
export const POPULAR_SITE_IDS: string[] = [
  "github", "gitlab", "codeberg", "stack-overflow", "dev-to", "hashnode", "replit", "codepen",
  "hugging-face", "kaggle", "leetcode", "npm", "pypi", "docker-hub", "product-hunt",
  "reddit", "x", "instagram", "tiktok", "youtube", "twitch", "pinterest", "tumblr",
  "mastodon", "mastodon-social", "bluesky", "threads", "vk", "telegram", "discord", "facebook", "linkedin",
  "medium", "substack", "wordpress", "blogspot", "deviantart", "behance", "dribbble", "artstation",
  "flickr", "imgur", "soundcloud", "bandcamp", "spotify", "last-fm", "patreon", "ko-fi",
  "steam", "roblox", "epic-games", "chess-com", "lichess", "strava", "duolingo", "goodreads",
  "letterboxd", "myanimelist", "hackernews", "quora", "keybase", "gravatar", "about-me", "linktree",
];

/** Full snapshot size, shown in the UI; update when regenerating sherlock-sites.ts. */
export const SHERLOCK_TOTAL = 464;

/**
 * Identity correlation types — shared between server functions, the
 * correlation engine and the Case Seeder UI.
 *
 * Rule: a signal is only "confirmed" when the source itself proves the link
 * (platform-declared link, Keybase cryptographic proof, verified GPG key).
 * Same handle alone is always "unconfirmed".
 */

export type IdentityConfidence = "confirmed" | "probable" | "unconfirmed";

export type SignalKind =
  | "username" | "email" | "url" | "domain" | "organization" | "person"
  | "crypto_key" | "location" | "note";

export type IdentitySignal = {
  id: string;
  kind: SignalKind;
  value: string;
  label?: string;
  source: string;
  sourceId: string;
  url?: string;
  confidence: IdentityConfidence;
  reason: string;
  at: string;
};

export type IdentityProfileField = { label: string; value: string; url?: string };

export type IdentityProfile = {
  source: string;
  username?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  avatarHash?: string;
  location?: string;
  company?: string;
  joined?: string;
  url?: string;
  fields: IdentityProfileField[];
};

export type IdentitySourceResult = {
  id: string;
  name: string;
  ok: boolean;
  note?: string;
  url?: string;
  profiles: IdentityProfile[];
  signals: IdentitySignal[];
  raw?: any;
};

export type DerivedMatch = {
  id: string;
  type: "avatar" | "handle" | "contact";
  a: string;
  b: string;
  confidence: IdentityConfidence;
  reason: string;
};

export type ScanSiteResult = {
  id: string;
  name: string;
  category: string;
  url: string;
  status: "found" | "not_found" | "blocked" | "unknown";
  httpStatus: number;
  detail?: string;
};

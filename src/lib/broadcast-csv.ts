/**
 * CSV → broadcast audience.
 *
 * The broadcast wizard's "Upload CSV" audience type needs a
 * `{ phone, name }[]` list, which is a narrower shape than the
 * contacts importer's. Rather than re-parse, this reuses the shared
 * `parseContactCsv` + `dedupeByPhone` so a CSV that imports cleanly on
 * the Contacts page also broadcasts cleanly (issue #512).
 *
 * De-duplication happens HERE, on the normalized number, because the
 * downstream contact upsert inserts against a UNIQUE index on
 * (account_id, phone_normalized) (migration 022). Two spellings of the
 * same number in one file ("+1 555-0100" and "15550100") would
 * otherwise reach that index as separate inserts and fail the whole
 * broadcast with a constraint error.
 *
 * Pure and unit-tested: the wizard is a client component and
 * `vitest.config.ts` runs `environment: "node"` with no jsdom, so the
 * logic has to live outside the component to be testable.
 */

import { dedupeByPhone } from '@/lib/contacts/dedupe';
import { parseContactCsv } from '@/lib/contacts/parse-contact-csv';

/** The shape the wizard hands to `createAndSendBroadcast`. */
export interface BroadcastCsvContact {
  phone: string;
  name?: string;
}

export type BroadcastCsvError =
  /** No `phone` header — the one column we can't work without. */
  | 'missing_phone_column'
  /** Header was fine, but not one row carried a usable number. */
  | 'no_valid_rows';

export type ParseBroadcastCsvResult =
  | {
      ok: true;
      contacts: BroadcastCsvContact[];
      /** Rows dropped as same-number repeats. */
      duplicates: number;
      /**
       * Rows dropped because the number is blank or lacks a leading `+`
       * and country code (issue #586). The wizard warns about these so
       * a CSV of national-format numbers doesn't silently shrink.
       */
      invalid: number;
    }
  | { ok: false; error: BroadcastCsvError };

/**
 * The file behind the wizard's "Download sample CSV" button. India has no
 * number range reserved for examples, so these use a +91 5xxxx series.
 * Indian mobile numbers start with 6 to 9, so an unedited sample is very
 * unlikely to reach a real person. CRLF so Excel on Windows opens it
 * cleanly; the parser accepts either ending.
 */
export const BROADCAST_SAMPLE_CSV =
  [
    'phone,name',
    '+915555500101,Rakesh',
    '+915555500102,Rahul',
    '+915555500103,Priya',
  ].join('\r\n') + '\r\n';

export type BroadcastCsvSkipReason = 'noPlus' | 'excel' | 'tooShort';

/**
 * Numbers shown in the wizard's guide note. Kept next to the parser and
 * run through it in the unit tests, so the note can never promise
 * something the parser doesn't do.
 */
export const BROADCAST_CSV_EXAMPLES: {
  accepted: string[];
  skipped: { value: string; reason: BroadcastCsvSkipReason }[];
} = {
  // Display only, never sent. Same number three ways: the parser ignores
  // spaces and dashes between the digits.
  accepted: ['+919876543210', '+91 98765 43210', '+91-98765-43210'],
  skipped: [
    { value: '9876543210', reason: 'noPlus' },
    { value: '9.19877E+11', reason: 'excel' },
    { value: '+91 98765', reason: 'tooShort' },
  ],
};

export function parseBroadcastCsv(text: string): ParseBroadcastCsvResult {
  const { rows, hasPhoneColumn } = parseContactCsv(text);

  if (!hasPhoneColumn) return { ok: false, error: 'missing_phone_column' };

  const { unique, duplicates, invalid } = dedupeByPhone(rows);
  if (unique.length === 0) return { ok: false, error: 'no_valid_rows' };

  return {
    ok: true,
    // Drop email/company/tags: the broadcast audience only addresses
    // people, and `name` is the sole field template variables can map.
    contacts: unique.map(({ phone, name }) =>
      name ? { phone, name } : { phone }
    ),
    duplicates,
    invalid,
  };
}

/**
 * QRS Cloud Functions entry point.
 *
 * Scrapers (added in the Scraping phase):
 *   - scrapePoints  : parse nhra.com season standings -> standings/{class}
 *   - scrapeResults : log into getresults.nhradata.com, pull event CSV ->
 *                     events/{eventId}/runs
 *
 * Both will be HTTPS-callable and gated to approved users; scrapeResults reads
 * portal credentials from Secret Manager.
 */

import { initializeApp } from "firebase-admin/app";

initializeApp();

// Functions are exported here as they are implemented.

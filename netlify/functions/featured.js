// Netlify serverless function: persists Qeffo's Featured Opportunities list
// using Netlify Blobs (same pattern as jobs.js, separate store).
//
// GET  -> returns the current featured list as JSON
// POST -> replaces the stored featured list with the JSON body sent

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'qeffo-featured';
const KEY = 'featured-list';

function getFeaturedStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token });
  }
  return getStore(STORE_NAME);
}

export async function handler(event) {
  const store = getFeaturedStore();

  if (event.httpMethod === 'GET') {
    try {
      const json = await store.get(KEY);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: json || '[]'
      };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const featured = JSON.parse(event.body || '[]');
      if (!Array.isArray(featured)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Expected a JSON array' }) };
      }
      await store.set(KEY, JSON.stringify(featured));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, count: featured.length })
      };
    } catch (err) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request: ' + err.message }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

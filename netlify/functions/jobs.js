// Netlify serverless function: persists the Qeffo job board's job list using
// Netlify Blobs (a built-in key/value store included with every Netlify site,
// no extra setup or database needed).
//
// This storage lives independently of your deployed code files. Redeploying
// or updating index.html later will NOT erase jobs saved here.
//
// GET  -> returns the current jobs array as JSON
// POST -> replaces the stored jobs array with the JSON body sent

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'qeffo-jobs';
const KEY = 'jobs-list';

function getJobsStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  // Prefer explicit manual configuration (works reliably in every deploy
  // context). Falls back to Netlify's automatic context if manual env vars
  // aren't set, for environments where auto-detection does work.
  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token });
  }
  return getStore(STORE_NAME);
}

export async function handler(event) {
  const store = getJobsStore();

  if (event.httpMethod === 'GET') {
    try {
      const jobsJson = await store.get(KEY);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: jobsJson || '[]'
      };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const jobs = JSON.parse(event.body || '[]');
      if (!Array.isArray(jobs)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Expected a JSON array' }) };
      }
      await store.set(KEY, JSON.stringify(jobs));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, count: jobs.length })
      };
    } catch (err) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request: ' + err.message }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

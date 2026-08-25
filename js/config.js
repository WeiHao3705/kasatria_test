// Public, non-secret configuration. OAuth Client IDs and Sheet IDs are safe to expose client-side.
export const GOOGLE_CLIENT_ID = '441035020956-5u246g5gd9jljsn4efugep6b45akm12j.apps.googleusercontent.com';

export const SHEET_ID = '1SchlDwXVEC-GHT7EK2tBtvfrwQ7rNfNI4EgA5GHziUc';

// Public CSV export endpoint. Requires the Sheet's general access to be
// "Anyone with the link: Viewer".
export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

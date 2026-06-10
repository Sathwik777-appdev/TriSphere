/**
 * Robustly parse various date formats from Firestore into a Date object.
 * Handles: Firebase Timestamp objects, JS Date objects, ISO strings, and numeric milliseconds.
 * 
 * @param {any} timestamp - The raw timestamp data from Firestore
 * @returns {Date|null} - A valid JS Date object or null if invalid
 */
export function parseFirestoreDate(timestamp) {
    if (!timestamp) return null;

    let d;
    if (typeof timestamp.toDate === 'function') {
        d = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        d = timestamp;
    } else {
        d = new Date(timestamp);
    }

    return isNaN(d.getTime()) ? null : d;
}

/**
 * Utility functions for quiz-related calculations and data processing.
 */

/**
 * Get final quiz scores per (student, chapter, subject).
 *
 * Scoring rule (matches the two-attempt AI-quiz flow):
 *   1. Drop malpractice attempts entirely.
 *   2. If the first valid attempt is a perfect 100, that single attempt
 *      stands as the final score — no retake needed, no averaging.
 *   3. Otherwise the final score is the AVERAGE of all valid attempts
 *      taken for that chapter (typically attempt 1 + attempt 2).
 *
 * Each returned entry keeps the latest attempt's metadata (date, quizId,
 * etc.) but its `score` is replaced with the computed final per the
 * rules above, and an `attemptCount` field is added so the UI can show
 * "averaged across N attempts" if it wants to.
 *
 * @param {Array} quizResults - Array of quiz result objects from Firestore
 * @returns {Array} - Array of processed final scores
 */
export const getFinalQuizScores = (quizResults) => {
    if (!quizResults || !Array.isArray(quizResults)) return [];

    const groupedByChapter = {};

    quizResults.forEach(result => {
        const key = `${result.studentId || result.userId}-${result.chapterName}-${result.subject}`;
        if (!groupedByChapter[key]) {
            groupedByChapter[key] = [];
        }
        groupedByChapter[key].push(result);
    });

    const finalScores = [];
    Object.values(groupedByChapter).forEach(attempts => {
        // Sort oldest → newest. Stable across either Timestamp or ISO.
        attempts.sort((a, b) => {
            const dateA = a.completedAt?.toDate?.() || new Date(a.completedAt || 0);
            const dateB = b.completedAt?.toDate?.() || new Date(b.completedAt || 0);
            return dateA - dateB;
        });

        // Step 1: ignore malpractice attempts when computing the final
        // score for the chapter. (We still keep the originals for any
        // caller that wants attempt-level data — they'll see this list
        // unchanged.)
        const valid = attempts.filter(a => !a.malpractice);
        if (valid.length === 0) {
            // No valid attempts — fall back to the most recent record
            // (likely a malpractice flag) so the chapter doesn't silently
            // disappear from progress views.
            finalScores.push(attempts[attempts.length - 1]);
            return;
        }

        const firstValid = valid[0];

        // Step 2: perfect first attempt → use it as-is, skip averaging.
        if (firstValid.score === 100) {
            finalScores.push({ ...firstValid, attemptCount: 1 });
            return;
        }

        // Step 3: average across all valid attempts for this chapter.
        const avg = Math.round(
            valid.reduce((sum, a) => sum + (a.score || 0), 0) / valid.length
        );
        const latest = valid[valid.length - 1];
        finalScores.push({
            ...latest,
            score: avg,
            attemptCount: valid.length,
        });
    });

    return finalScores;
};

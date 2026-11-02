/**
 * Shared name-variant & email matching logic for linking conference presentations
 * (program slots and posters) to registered participants on certificates and views.
 */

const cleanStr = (s) => (s || '')
    .trim()
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_.'\u2019]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshtein = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[a.length][b.length];
};

export function compareNames(presenter, firstName, lastName, participantEmail = '', authorEmail = '') {
    const pEmailClean = (participantEmail || '').trim().toLowerCase();
    const aEmailClean = (authorEmail || '').trim().toLowerCase();
    if (pEmailClean && aEmailClean && pEmailClean === aEmailClean) {
        return true;
    }

    if (!presenter || !firstName || !lastName) return false;
    const pRaw = presenter.trim();
    const firstClean = cleanStr(firstName);
    const lastClean = cleanStr(lastName);
    if (!firstClean || !lastClean) return false;

    const firstCompact = firstClean.replace(/\s+/g, '');
    const lastCompact = lastClean.replace(/\s+/g, '');

    const emailUser = pEmailClean ? pEmailClean.split('@')[0].replace(/[^a-z0-9]/g, '') : '';
    const authorEmailUser = aEmailClean ? aEmailClean.split('@')[0].replace(/[^a-z0-9]/g, '') : '';

    // Case 1: Presenter contains a comma (usually "LastName, FirstName")
    if (pRaw.includes(',')) {
        const parts = pRaw.split(',');
        const presLast = cleanStr(parts[0]);
        const presFirst = cleanStr(parts[1] || '');
        const presLastCompact = presLast.replace(/\s+/g, '');
        const presFirstCompact = presFirst.replace(/\s+/g, '');

        const lastTokens = lastClean.split(' ').filter(t => t.length >= 2);
        const presLastTokens = presLast.split(' ').filter(t => t.length >= 2);
        const allFullTokens = `${firstClean} ${lastClean}`.split(' ').filter(t => t.length > 2);

        const lastMatch = presLast === lastClean ||
            presLastCompact === lastCompact ||
            (lastClean.includes(presLast) && presLast.length > 2) ||
            (presLast.includes(lastClean) && lastClean.length > 2) ||
            (presLastTokens.length > 0 && presLastTokens.every(t => lastTokens.includes(t))) ||
            (lastTokens.length > 0 && lastTokens.every(t => presLastTokens.includes(t))) ||
            (presLastTokens.length >= 2 && presLastTokens.every(t => allFullTokens.includes(t))) ||
            (presLastTokens.some(t => t.length > 2 && lastTokens.includes(t)) && (presFirst === firstClean || presFirstCompact === firstCompact));

        const firstTokens = firstClean.split(' ').filter(t => t.length > 1);
        const presFirstTokens = presFirst.split(' ').filter(t => t.length > 1);
        const firstMatch = presFirst === firstClean ||
            presFirstCompact === firstCompact ||
            presFirst.includes(firstClean) ||
            firstClean.includes(presFirst) ||
            (firstTokens.length > 0 && presFirstTokens.length > 0 && firstTokens[0] === presFirstTokens[0]) ||
            (firstClean.length >= 5 && presFirst.length >= 5 && levenshtein(firstClean, presFirst) <= 1) ||
            (presFirstCompact.length >= 4 && emailUser.startsWith(presFirstCompact));

        return Boolean(lastMatch && firstMatch);
    }

    // Case 2: No comma, check direct combinations and normalized compact forms
    const presenterClean = cleanStr(pRaw);
    const presenterCompact = presenterClean.replace(/\s+/g, '');
    if (presenterClean === `${firstClean} ${lastClean}` || presenterClean === `${lastClean} ${firstClean}`) return true;
    if (presenterCompact === `${firstCompact}${lastCompact}` || presenterCompact === `${lastCompact}${firstCompact}`) return true;
    if (presenterClean.includes(firstClean) && presenterClean.includes(lastClean)) return true;

    // Case 3: Token subset check for compound names (e.g. "Paola G Abrego Martinez" vs "Paola Gabriela Abrego Martinez")
    const pTokens = presenterClean.split(' ').filter(Boolean);
    const fTokens = firstClean.split(' ').filter(Boolean);
    const lTokens = lastClean.split(' ').filter(Boolean);
    const lSig = lTokens.filter(t => t.length > 2);
    const pLastCandidates = pTokens.filter(t => !fTokens.includes(t) && t.length > 2);
    const surnameOverlap = lSig.length > 0 && (
        lSig.every(t => pTokens.includes(t)) ||
        (pLastCandidates.length > 0 && pLastCandidates.every(t => lSig.includes(t)))
    );
    if (surnameOverlap && fTokens[0] && fTokens[0].length > 2 && pTokens[0] === fTokens[0]) {
        return true;
    }

    // Case 4: Nickname / legal first name confirmed by email local part when surname matches exactly
    if (pTokens.length >= 2 && pTokens.slice(1).join(' ') === lastClean) {
        const pFirstToken = pTokens[0] || '';
        if (pFirstToken.length >= 4 && emailUser.startsWith(pFirstToken) && emailUser.includes(lastCompact)) {
            return true;
        }
        if (firstCompact.length >= 4 && authorEmailUser.startsWith(firstCompact) && authorEmailUser.includes(lastCompact)) {
            return true;
        }
    }

    return false;
}

export function getPresentationsForParticipant(participant, slots = [], posters = []) {
    const presentations = [];
    const seen = new Set();
    const fName = participant.firstName || '';
    const lName = participant.lastName || '';
    const pEmail = participant.email || '';

    for (const slot of slots) {
        if (slot.presenter_name && compareNames(slot.presenter_name, fName, lName, pEmail)) {
            const type = slot.type ? (slot.type.charAt(0).toUpperCase() + slot.type.slice(1)) : 'Oral';
            const dedupKey = `${type.toLowerCase()}||${(slot.title || '').trim().toLowerCase()}`;
            if (!seen.has(dedupKey)) {
                seen.add(dedupKey);
                presentations.push({
                    title: slot.title,
                    type
                });
            }
        }
    }

    for (const poster of posters) {
        let authors = [];
        try {
            authors = typeof poster.authors === 'string' ? JSON.parse(poster.authors) : poster.authors;
        } catch (e) {}

        if (Array.isArray(authors) && authors.length > 0) {
            const hasExplicitPresenter = authors.some(a => a && a.presenting === true);
            const authorsToCheck = hasExplicitPresenter
                ? authors.filter(a => a && a.presenting === true)
                : [authors[0]];

            let isAuthor = false;
            for (const author of authorsToCheck) {
                let aName = '';
                let aEmail = '';
                if (typeof author === 'string') {
                    aName = author;
                } else if (author) {
                    aEmail = author.email || '';
                    if (author.name) {
                        aName = author.name;
                    } else if (author.firstName) {
                        aName = `${author.firstName} ${author.lastName || ''}`.trim();
                    } else if (author.lastName) {
                        aName = author.lastName;
                    }
                }

                if ((aName || aEmail) && compareNames(aName, fName, lName, pEmail, aEmail)) {
                    isAuthor = true;
                    break;
                }
            }

            if (isAuthor) {
                const dedupKey = `poster||${(poster.title || '').trim().toLowerCase()}`;
                if (!seen.has(dedupKey)) {
                    seen.add(dedupKey);
                    presentations.push({
                        title: poster.title,
                        type: 'Poster'
                    });
                }
            }
        }
    }

    return presentations;
}


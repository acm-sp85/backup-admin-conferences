import fs from 'fs';
import path from 'path';
import { query } from '../src/lib/db.js';

// Normalization function to handle accents, cases, and spacing differences
function normalizeName(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, "")       // keep only alphanumeric
        .trim();
}

async function main() {
    try {
        const csvPath = path.join(process.cwd(), 'scratch', 'CIPIE_Affiliations.csv');
        if (!fs.existsSync(csvPath)) {
            console.error(`CSV file not found at: ${csvPath}`);
            process.exit(1);
        }

        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split(/\r?\n/);
        
        // Build map of normalized_name -> { original_name, email, entity }
        const affiliationMap = new Map();
        
        console.log(`Processing CSV lines...`);
        // Start from line 1 (skipping header)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // The format is "presenter_name","email","entity"
            // Strip the leading and trailing quotes, then split by ","
            if (line.startsWith('"') && line.endsWith('"')) {
                const inner = line.slice(1, -1);
                const parts = inner.split('","');
                if (parts.length >= 3) {
                    const presenter_name = parts[0];
                    const email = parts[1];
                    const entity = parts[2];
                    
                    const norm = normalizeName(presenter_name);
                    if (norm) {
                        affiliationMap.set(norm, { presenter_name, email, entity });
                    }
                }
            }
        }
        
        console.log(`Loaded ${affiliationMap.size} affiliation mappings from CSV.`);

        // Fetch all program slots for CIPIE (conference_id = 11)
        const slots = await query(`
            SELECT ps.id, ps.presenter_name, ps.presenter_entity
            FROM program_slots ps
            JOIN program_sessions s ON ps.session_id = s.id
            WHERE s.conference_id = 11
        `);

        console.log(`Found ${slots.length} program slots for conference 11.`);

        let matchedCount = 0;
        let unmatchedCount = 0;
        const unmatchedNames = new Set();

        for (const slot of slots) {
            const presenterName = slot.presenter_name;
            if (!presenterName) continue;

            // Split presenterName by common separators: commas, slashes, or "y/and"
            // Note: Use regex that looks for comma, slash, " y ", " and "
            const individualNames = presenterName.split(/,|\/|\b[yY]\b|\b[aA][nN][dD]\b/g);
            
            const matchedEntities = [];
            let hasMatch = false;

            for (const rawName of individualNames) {
                const nameClean = rawName.trim();
                if (!nameClean) continue;

                const norm = normalizeName(nameClean);
                const match = affiliationMap.get(norm);
                if (match && match.entity) {
                    matchedEntities.push(match.entity);
                    hasMatch = true;
                }
            }

            if (hasMatch) {
                // De-duplicate entities
                const uniqueEntities = [...new Set(matchedEntities)];
                const joinedEntities = uniqueEntities.join(' / ');

                // Update the slot with the matched entity
                await query(
                    `UPDATE program_slots SET presenter_entity = ? WHERE id = ?`,
                    [joinedEntities, slot.id]
                );
                matchedCount++;
            } else {
                unmatchedCount++;
                unmatchedNames.add(presenterName);
            }
        }

        console.log(`\nSync Completed!`);
        console.log(`Successfully matched and updated: ${matchedCount} slots.`);
        console.log(`Unmatched slots: ${unmatchedCount}`);
        
        if (unmatchedNames.size > 0) {
            console.log('\nUnmatched presenter names:');
            console.log(Array.from(unmatchedNames).sort());
        }

    } catch (error) {
        console.error('Error running import:', error);
    }
    process.exit(0);
}

main();

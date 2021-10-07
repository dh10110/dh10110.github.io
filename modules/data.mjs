import { readDelimitedFile } from './lineReader.mjs';
import { getOrAdd } from './mapUtil.mjs';

export async function getRidings() {
    //Get text file content
    const ridings = await fetch('/datafiles/districts.txt')
        .catch(err => console.log(err))
        .then(response => response.text())
        .then(text => {
            const ridings = [];
            const lines = text.split(/\r\n|[\r\n]/g);
            const skipLines = 1; //header
            for (let lineIndex = skipLines; lineIndex < lines.length; lineIndex += 1) {
                const line = lines[lineIndex];
                const values = line.split(/,/g);
                if (values.length >= 2) {
                    ridings.push({
                        riding: values[0],
                        districts: values[1].split(/~/g)
                    });
                }
            }
            return ridings;
        });
    return ridings;
}

export async function getVotingResults() {
    const results = await fetch('/datafiles/GE2021.txt')
        .catch(err => console.log(err))
        .then(response => response.text())
        .then(text => readDelimitedFile(text, { skip: 2, delimiter: '\t' }))
        .then(lines => {
            const districts = new Map();
            for (const cols of lines) {
                if (cols.length >= 14) {
                    const [district_number, district_name, , results_type, , surname, ,, party, , votes, , district_rejected_ballots, district_total_votes] = cols;
                    if (results_type === 'validated') {
                        const districtItem = getOrAdd(map, district_number, () => ({
                            district_number, district_name, district_total_votes, district_rejected_ballots,
                            candidates: []
                        }));
                        districtItem.candidates.push({
                            surname, party, votes
                        });
                    }
                }
            }
            return districts;
        });
    return results;
}


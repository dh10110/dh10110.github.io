import { readDelimitedFile } from './lineReader.mjs';
import { getOrAdd } from './mapUtil.mjs';

export async function getParties() {
    const parties = await fetch('/datafiles/parties.json', { cache: 'no-cache' })
        .catch(err => console.log(err))
        .then(response => response.json());
    return parties;
}

export async function getRidings() {
    //Get text file content
    const ridings = await fetch('/datafiles/districts.txt', { cache: 'no-cache' })
        .catch(err => console.log(err))
        .then(response => response.text())
        .then(text => readDelimitedFile(text, { skip: 1, delimiter: ',' }))
        .then(lines => {
            const ridings = [];
            for (const values of lines) {
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
                    const [district_number, district_name, , results_type, , surname, middle_name, given_name, party, , votes, vote_pct, district_rejected_ballots, district_total_votes] = cols;
                    if (results_type === 'validated') {
                        const districtItem = getOrAdd(districts, district_number, () => ({
                            district_number, district_name,
                            district_total_votes: Number(district_total_votes),
                            district_rejected_ballots: Number(district_rejected_ballots),
                            candidates: []
                        }));
                        districtItem.candidates.push({
                            surname, middle_name, given_name, party,
                            votes: Number(votes),
                            vote_pct: Number(vote_pct)
                        });
                    }
                }
            }
            return districts;
        });
    return results;
}


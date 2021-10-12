import { readDelimitedFile } from './lineReader.mjs';
import { getOrAdd } from './mapUtil.mjs';
import { District, Candidate } from './classes.mjs';

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
                    const [districtNumber, districtName, , resultsType, , surname, middleNames, givenName, partyName, , votes, votePct, rejectedBallots, totalBallots] = cols;
                    if (resultsType === 'validated') {
                        const districtItem = getOrAdd(districts, districtNumber, () => new District({
                            districtNumber, districtName, rejectedBallots, totalBallots
                        }));
                        districtItem.addCandidate(new Candidate({
                            surname, middleNames, givenName, partyName, votes, votePct
                        }));
                    }
                }
            }
            return districts;
        });
    return results;
}


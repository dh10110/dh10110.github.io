
/**
 * Create an instance of a candidate
 */
export class Candidate {
    constructor({ surname, givenName, partyName, votes = 0, votePct = 0 } = {}) {
        votes = Number(votes);
        votePct = Number(votePct);
        Object.assign(this, { surname, givenName, partyName, votes, votePct });
    }
}

export const stvCandidateState = {
    INITIAL: { code: 0 },
    WITHDRAWN: { code: 1 },
    DEFEATED: { code: 2 },
    HOPEFUL: { code: 3, stillIn: true },
    PENDING: { code: 4, stillIn: true },
    ELECTED: { code: 5, stillIn: true }
};

export class StvCandidate {
    constructor({ candidateId, vote } = {}) {
        vote = Number(vote);
        Object.assign(this, { candidateId, vote });
        this.state = stvCandidateState.INITIAL;
        this.surplus = 0;
        this.assignedBallots = new Set();
    }


}

export class CandidateGroup {
    constructor({ groupName, color, votes = 0 }) {
        votes = Number(votes);
        Object.assign(this, { groupName, color, votes });
        this.candidates = [];
    }

    addCandidate(candidate) {
        this.candidates.push(candidate);
    }
}

/**
 * Create an instance of a voting district
 */
 export class District {
    constructor({ districtNumber, districtName, totalBallots = 0, rejectedBallots = 0 } = {}) {
        totalBallots = Number(totalBallots);
        rejectedBallots = Number(rejectedBallots);
        Object.assign(this, { districtNumber, districtName, totalBallots, rejectedBallots });
        this.candidates = [];
    }

    get validVotes() {
        return this.totalBallots - this.rejectedBallots;
    }

    addCandidate(candidate) {
        this.candidates.push(candidate);
    }
}

export class StvDistrict extends District {
    constructor({ districtName } = {}) {
        super({ districtName });
        this.districts = [];
        this.seats = 0;
    }

    /**
     * Add a district to this larger STV district;
     * @param district {District}
     */
    addDistrict(district) {
        this.districts.push(district);
        this.seats += 1;
    }
}

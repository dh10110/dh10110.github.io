import { floor } from './mathUtil.mjs';
import { first } from './arrayUtil.mjs';

export const candidateStatus = {
    WITHDRAWN = { text: 'Withdrawn', level: 0 },
    HOPEFUL = { text: 'Hopeful', level: 1 },
    DEFEATED = { text: 'Defeated', level: 0 },
    PENDING = { text: 'Pending', level: 2 },
    ELECTED = { text: 'Elected', level: 3 }
};

export class ElectWigm {
    constructor(stvDistrict, ballots) {
        //this.stvDistrict = stvDistrict;
        this.seats = stvDistrict.seats;
        this.candidates = stvDistrict.candidates;
        this.precision = 4;
        this.ballots = ballots;
        //TODO: this.defeatSureLosers

        this.hopeful = new Set();
        this.pending = new Set();
        this.elected = new Set();
        this.defeated = new Set();
    }

    count() {
        //https://prfound.org/resources/reference/reference-wigm-rule/

        //Ref A - Initialize Election
        let shouldContinue = this.initialize();

        //Ref B - Round
        while (shouldContinue) {
            shouldContinue = round();
        }

        //Ref C - Finish Count
        //Elect all pending candidates
        this.elected.add(...this.pending);
        this.pending.clear();
        //All seats filled?
        if (this.pending.size === this.seats) {
            //defeat all remaining hopeful candidates
            this.defeated.add(...this.hopeful);
            this.hopeful.clear();
        } else {
            //Elect all remaining hopeful candidate
            this.elected.add(...this.hopeful);
            this.hopeful.clear();
        }
    }

    //Ref A - Initialize Election
    initialize() {
        //prep
        for (const candidate in this.candidates) {
            candidate.wigm = { vote: 0, surplus: 0 };
        }
        //Ref A.1 - Set the Quota
        this.quota = floor(ballots.length / (this.seats + 1), this.precision);
        //Ref A.2 - Set candidates to HOPEFUL
        this.hopeful.add(...this.candidates);
        //Ref A.3 - Test count complete (D.3)
        if (this.testCountComplete()) {
            return false; //complete
        }
        //Ref A.4 - Set ballot weight and assign to candidate
        //Ref A.5 - Set candidate vote
        for (const ballot of this.ballots) {
            ballot.weight = 1;
            ballot.candidates[0].wigm.vote += 1;
        }
        //Continue
        return true;
    }

    //Ref B - Round
    round() {
        //Ref B.1 - Elect Winners
        for (const candidate of this.hopeful) {
            if (candidate.wigm.vote >= this.quota) {
                this.hopeful.delete(candidate);
                this.pending.add(candidate);
                candidate.wigm.surplus = candidate.wigm.vote - this.quota;
            }
        }
        if (this.testCountComplete()) {
            return false;
        }
        //Ref B.2 (optional) - Defeat sure losers
        if (this.defeatSureLosers) {
            //TODO
        }
        //Ref B.3 - Transfer high surplus
        const highSurplus = first(this.pending, desc(c => c.wigm.surplus), c => c.tieOrder)
        if (highSurplus) {
            //TODO
            //for each assigned ballot
            //ballot.weight = floor(ballot.weight * candidate.wigm.surplus / candidate.wigm.vote, this.precision);
            //TODO
            //transfer ballot
            return true; //continue at B.1
        }
        //Ref B.4 - Defeat low candidiate
        const lowest = first(this.hopeful, c => c.wigm.vote, c => c.tieOrder);
        this.hopeful.delete(lowest);
        defeated.add(lowest);
        if (this.testCountComplete()) {
            return false;
        }
        //TODO
        //for each assigned ballot
        //transfer ballot
        //Continue at B.1
        return true;
    }

    //Ref D.2
    transferBallots() {

    }

    //Ref D.3
    testCountComplete() {
        return this.elected.size + this.pending.size === this.seats ||
            this.elected.seats + this.pending.size + this.hopeful.size <= this.seats;
    }

}


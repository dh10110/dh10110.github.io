import { floor } from './mathUtil.mjs';

export const candidateStatus = {
    WITHDRAWN = { text: 'Withdrawn', level: 0 },
    HOPEFUL = { text: 'Hopeful', level: 1 },
    DEFEATED = { text: 'Defeated', level: 0 },
    PENDING = { text: 'Pending', level: 2 },
    ELECTED = { text: 'Elected', level: 3 }
};

export class ElectWigm {
    constructor(stvDistrict) {
        //this.stvDistrict = stvDistrict;
        this.seats = stvDistrict.seats;
        this.candidates = stvDistrict.candidates;
        this.precision = 4;
        //TODO: this.defeatSureLosers

        this.hopeful = new Set();
        this.pending = new Set();
        this.elected = new Set();
        this.defeated = new Set();
    }

    count(ballots) {
        //https://prfound.org/resources/reference/reference-wigm-rule/

        //Ref A - Initialize Election
        let isComplete = this.initialize();

        //Ref B - Round
        while (!isComplete) {
            isComplete = round();
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
        //Ref A.1 - Set the Quota
        this.quota = floor(ballots.length / (this.seats + 1), this.precision);
        //Ref A.2 - Set candidates to HOPEFUL
        this.hopeful.add(...this.candidates);
        //Ref A.3 - Test count complete (D.3)
        if (this.testCountComplete()) {
            //return? go to Ref C
        }
        //Ref A.4 - Set ballot weight and assign
        //Ref A.5 - Set candidate vote
    }

    //Ref B - Round
    round() {
        //Ref B.1 - Elect Winners
        //Ref B.2 (optional) - Defeat sure losers
        //Ref B.3 - Transfer high surplus
        //Ref B.4 - Defeat low candidiate
    }

    //Ref D.1
    breakTie(tied, reason) {
        
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


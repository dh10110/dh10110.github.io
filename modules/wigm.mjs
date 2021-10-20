import { floor } from './mathUtil.mjs';
import { concat } from './mapUtil.mjs';
import { first, orderBy, desc } from './arrayUtil.mjs';

//TODO: shared with other count classes
export const candidateStatus = {
    WITHDRAWN: { text: 'Withdrawn', level: 0 },
    HOPEFUL: { text: 'Hopeful', level: 1, canTransferTo: true },
    DEFEATED: { text: 'Defeated', level: 0 },
    PENDING: { text: 'Pending', level: 2 },
    ELECTED: { text: 'Elected', level: 3 }
};

function tplCandidate(candidate) {
    return `<span style="color: ${candidate.color};" title="${candidate.partyName}">⬤</span>${candidate.surname}`
}

export class ElectWigm {
    constructor(stvDistrict, ballots, postMessage) {
        this.districtName = stvDistrict.districtName;
        this.seats = stvDistrict.seats;
        this.candidates = stvDistrict.candidates;
        this.precision = 4;
        this.ballots = ballots;
        
        this.defeatSureLosers = false; //TODO

        this.hopeful = new Set();
        this.pending = new Set();
        this.elected = new Set();
        this.defeated = new Set();

        this.roundNum = 0;
        this.exhaustedBallots = 0;

        this.postMessage = (message) => {
            if (postMessage) postMessage(message);
        }
    }

    count() {
        const startTime = performance.now();

        this.prep();
        //https://prfound.org/resources/reference/reference-wigm-rule/
        //Ref A - Initialize Election
        let shouldContinue = this.initialize();
        //Ref B - Round
        while (shouldContinue) {
            this.roundNum += 1;
            shouldContinue = this.round();
        }
        //Ref C - Finish Count
        this.finishCount();

        //Report
        this.postMessage({progress: null, heading: 'Final Winners', final: true, exhausted: this.exhaustedBallots, candidates: [...this.elected.values()] });

        const endTime = performance.now();
        console.log(`Runtime for 'wigm' ${this.districtName} - ${endTime - startTime}ms`)
    }

    //Prep data structure
    prep() {
        for (const candidate of this.candidates) {
            candidate.stv = { vote: 0, surplus: 0, assignedBallots: new Set() };
        }
        //TODO: move tieOrder definition outside counting classes
        let tieOrder = 0;
        for (const candidate of orderBy(this.candidates, c => c.surname, c => c.givenName, c => c.partyName)) {
            candidate.tieOrder = tieOrder++;
        }
    }

    //Ref A - Initialize Election
    initialize() {
        //Ref A.1 - Set the Quota
        this.quota = this.trunc(this.ballots.length / (this.seats + 1)) + 10e-4;
        //Ref A.2 - Set candidates to HOPEFUL
        for (const candidate of this.candidates) {
            candidate.stv.state = candidateStatus.HOPEFUL;
            this.hopeful.add(candidate);
        }
        //Ref A.3 - Test count complete (D.3)
        if (this.testCountComplete()) return false;
        //Ref A.4 - Set ballot weight and assign to candidate
        //+ Ref A.5 - Set candidate vote
        for (const ballot of this.ballots) {
            ballot.weight = 1;
            ballot.candidates[0].stv.assignedBallots.add(ballot);
            ballot.candidates[0].stv.vote += 1;
        }
        //Continue
        return true;
    }

    //Ref B - Round
    round() {
        this.postMessage({progress: `Round ${this.roundNum}`});

        //Ref B.1 - Elect Winners
        for (const candidate of this.hopeful) {
            if (candidate.stv.vote >= this.quota) {
                this.hopeful.delete(candidate);
                candidate.stv.state == candidateStatus.PENDING;
                this.pending.add(candidate);
                candidate.stv.surplus = candidate.stv.vote - this.quota;
            }
        }
        if (this.testCountComplete()) return false; //D.3
        //Ref B.2 (optional) - Defeat sure losers
        if (this.defeatSureLosers) {
            //TODO
        }
        //Ref B.3 - Transfer high surplus
        const highCandidate = first(this.pending, desc(c => c.stv.surplus), c => c.tieOrder)
        if (highCandidate) {
            this.pending.delete(highCandidate);
            highCandidate.stv.state = candidateStatus.ELECTED;
            this.elected.add(highCandidate);
            highCandidate.stv.winnerOrder = this.elected.size;
            for (const ballot of highCandidate.stv.assignedBallots.values()) {
                ballot.weight = this.trunc(ballot.weight * highCandidate.stv.surplus / highCandidate.stv.vote);
            }
            this.transferBallots(highCandidate);
            highCandidate.stv.vote = this.quota;

            this.postMessage({
                heading: `Round ${this.roundNum} - Elected: ${tplCandidate(highCandidate)}`,
                quota: this.quota,
                candidates: [...this.elected.values(), ...this.pending.values(), ...this.hopeful.values()]
            });
            return true; //continue at B.1
        }
        //Ref B.4 - Defeat low candidiate
        const lowCandidate = first(this.hopeful, c => c.stv.vote, c => c.tieOrder);
        if (lowCandidate == null) {
            console.error('No low candidate');
        }
        this.hopeful.delete(lowCandidate);
        lowCandidate.stv.state = candidateStatus.DEFEATED;
        this.defeated.add(lowCandidate);
        lowCandidate.stv.vote = 0;
        if (this.testCountComplete()) return false; //D.3
        this.transferBallots(lowCandidate);
        this.postMessage({
            heading: `Round ${this.roundNum} - Defeated: ${tplCandidate(lowCandidate)}`,
            candidates: [...this.elected.values(), ...this.pending.values(), ...this.hopeful.values(), lowCandidate]
        });
    
        return true; //Continue at B.1
    }

    //Ref C - Finish Count
    finishCount() {
        //Elect all pending candidates
        if (this.pending.size > 0) {
            this.postMessage({
                heading: `Finish Count - Elected Pending: ${concat(this.pending, c => tplCandidate(c))}`,
                candidates: [...this.elected.values(), ...this.pending.values(), ...this.hopeful.values()]
            });
        }
        for (const candidate of this.pending) {
            candidate.stv.state = candidateStatus.ELECTED;
            this.elected.add(candidate);
            candidate.stv.winnerOrder = this.elected.size;
        }
        this.pending.clear();
        //All seats filled?
        if (this.pending.size === this.seats) {
            //defeat all remaining hopeful candidates
            for (const candidate of this.hopeful) {
                candidate.stv.state = candidateStatus.DEFEATED;
                this.defeated.add(candidate);
            }
            this.hopeful.clear();
        } else {
            //Elect all remaining hopeful candidate
            this.postMessage({
                heading: `Finish Count - Elected Hopeful: ${concat(this.hopeful, c => tplCandidate(c))}`,
                candidates: [...this.elected.values(), ...this.hopeful.values()]
            });
            for (const candidate of this.hopeful) {
                candidate.stv.state = candidateStatus.DEFEATED;
                this.elected.add(candidate);
            }
            this.hopeful.clear();
        }
    }

    //Ref D.2
    transferBallots(candidate) {
        for (const ballot of candidate.stv.assignedBallots.values()) {
            const newCandidate = nextCandidate(ballot.candidates, candidate);
            candidate.stv.assignedBallots.delete(ballot);
            if (newCandidate && ballot.weight) {
                newCandidate.stv.assignedBallots.add(ballot);
                newCandidate.stv.vote += ballot.weight;
            } else {
                this.exhaustedBallots += 1;
            }
        }
    }

    //Ref D.3
    testCountComplete() {
        //complete if all seats filled, or remaining candidate will fill them
        return this.elected.size + this.pending.size === this.seats ||
            this.elected.size + this.pending.size + this.hopeful.size <= this.seats;
    }

    //Ref D.4
    trunc(number) {
        return floor(number, this.precision);
    }

}

function nextCandidate(candidates, curCandidate) {
    let nextCandidate = null;
    for (const candidate of candidates) {
        if (candidate !== curCandidate && candidate.stv.state.canTransferTo) {
            return candidate;
        }
    }
}

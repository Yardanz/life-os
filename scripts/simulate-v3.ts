/* eslint-disable no-console */
import { computeDayV3 } from "../lib/scoring/engine";
import type { DailyCheckInInput, EngineInput, PreviousBioStateInput, PreviousSnapshotInput, WeightConfigInput } from "../lib/scoring/types";

const config: WeightConfigInput = {
  configVersion: 1,
  overloadK: 12,
  trendDelta: 1.5,
  momentumWeight: 0.15,
  decay: {
    Energy: 1 / 7,
    Focus: 1 / 7,
    Discipline: 1 / 7,
    Finance: 1 / 7,
    Growth: 1 / 7,
  },
  factors: {
    Energy: {
      S: { weight: 18, lag: 0 },
      W: { weight: 10, lag: 0 },
      DW: { weight: -5, lag: 0 },
      L: { weight: 4, lag: 0 },
      M: { weight: 3, lag: 0 },
      T: { weight: 12, lag: 0 },
    },
    Focus: {
      S: { weight: 6, lag: 1 },
      W: { weight: 5, lag: 0 },
      DW: { weight: 16, lag: 0 },
      L: { weight: 6, lag: 1 },
      M: { weight: 2, lag: 0 },
      T: { weight: 10, lag: 0 },
    },
    Discipline: {
      S: { weight: 5, lag: 1 },
      W: { weight: 9, lag: 0 },
      DW: { weight: 12, lag: 0 },
      L: { weight: 10, lag: 0 },
      M: { weight: 1, lag: 0 },
      T: { weight: 8, lag: 0 },
    },
    Finance: {
      S: { weight: 2, lag: 0 },
      W: { weight: 0, lag: 0 },
      DW: { weight: 8, lag: 1 },
      L: { weight: 7, lag: 1 },
      M: { weight: 22, lag: 0 },
      T: { weight: 4, lag: 0 },
    },
    Growth: {
      S: { weight: 4, lag: 0 },
      W: { weight: 4, lag: 0 },
      DW: { weight: 9, lag: 0 },
      L: { weight: 16, lag: 0 },
      M: { weight: 1, lag: 0 },
      T: { weight: 6, lag: 0 },
    },
  },
  overloadPenaltyWeights: {
    Energy: 1,
    Focus: 1,
    Discipline: 1,
  },
  bio: {
    reserveSleepGain: 0.06,
    reserveWorkCost: 0.03,
    reserveStressCost: 0.04,
    fatigueCarry: 0.92,
    fatigueWorkGain: 0.025,
    fatigueStressGain: 0.03,
    fatigueSleepRecovery: 0.045,
    strainCarry: 0.9,
    strainFatigueWeight: 0.45,
    overloadLevel1Threshold: 45,
    overloadLevel2Threshold: 70,
    overloadRecoverThreshold: 35,
    baseFocus: 50,
    focusFromEnergy: 0.11,
    focusFromFatigue: 0.09,
    focusFromStress: 0.12,
    optLoadMin: 0.35,
    optLoadMax: 0.75,
    adaptGain: 0.03,
    burnoutPenalty: 0.06,
    disciplineCarry: 0.96,
    debtCarry: 0.96,
    debtRecoveryFactor: 12,
    adaptiveCarry: 0.98,
    bufferGain: 0.6,
    bufferCarry: 0.65,
    bufferSpendMax: 35,
    reserveFromBuffer: 0.35,
    fatigueFromBuffer: 0.45,
    stressCarry: 0.75,
    stressGain: 0.9,
    stressRecovery: 0.35,
    trainingIn: 35,
    trainingCarry: 0.7,
    trainingSpendMax: 20,
    trainingReserveBonus: 0.18,
    trainingDisciplineBonus: 0.28,
    trainingAdaptiveBonus: 0.12,
    workoutSameDayCostReserve: 8,
    workoutSameDayCostFatigue: 6,
    sympCarry: 0.78,
    paraCarry: 0.78,
    sympFromStress: 0.55,
    sympFromLoad: 0.35,
    sympFromStrain: 0.25,
    paraFromSleep: 0.45,
    paraFromRecovery: 0.35,
    paraFromCircadian: 0.25,
    paraSuppressedByStressLoad: 0.25,
  },
};

function day(dateString: string, values: Omit<DailyCheckInInput, "date">): DailyCheckInInput {
  return { date: new Date(`${dateString}T00:00:00.000Z`), ...values };
}

const checkins: DailyCheckInInput[] = [
  day("2026-02-10", { stress: 4, sleepHours: 8, sleepQuality: 4.5, workout: 1, deepWorkMin: 80, learningMin: 30, moneyDelta: 120 }),
  day("2026-02-11", { stress: 5, sleepHours: 7, sleepQuality: 4, workout: 1, deepWorkMin: 110, learningMin: 45, moneyDelta: -80 }),
  day("2026-02-12", { stress: 6, sleepHours: 6.5, sleepQuality: 3.5, workout: 0, deepWorkMin: 130, learningMin: 55, moneyDelta: 250 }),
  day("2026-02-13", { stress: 8, sleepHours: 5.5, sleepQuality: 2.8, workout: 0, deepWorkMin: 160, learningMin: 60, moneyDelta: -450 }),
  day("2026-02-14", { stress: 7, sleepHours: 6, sleepQuality: 3.2, workout: 1, deepWorkMin: 120, learningMin: 40, moneyDelta: 0 }),
  day("2026-02-15", { stress: 5, sleepHours: 7.5, sleepQuality: 4.2, workout: 1, deepWorkMin: 90, learningMin: 35, moneyDelta: 150 }),
  day("2026-02-16", { stress: 4, sleepHours: 8, sleepQuality: 4.8, workout: 1, deepWorkMin: 70, learningMin: 30, moneyDelta: 300 }),
];

let prevSnapshot: PreviousSnapshotInput | undefined;
let prevPrevSnapshot: PreviousSnapshotInput | undefined;
let prevBio: PreviousBioStateInput | undefined;
let prevPrevBio: PreviousBioStateInput | undefined;
const lifeScoreHistory: number[] = [];

console.log("date       ovl  Energy  dE    Focus  dF    Disc   dD    Fin    dFin  Grow   dG");

for (const checkin of checkins) {
  const input: EngineInput = {
    checkIn: checkin,
    previousSnapshot: prevSnapshot,
    previousPreviousSnapshot: prevPrevSnapshot,
    prevBioState: prevBio,
    prevPrevBioState: prevPrevBio,
    config,
    previousLifeScores: lifeScoreHistory.slice(-7),
  };

  const result = computeDayV3(input);
  const p = prevSnapshot?.stats ?? { Energy: 50, Focus: 50, Discipline: 50, Finance: 50, Growth: 50 };

  const dE = result.stats.Energy - p.Energy;
  const dF = result.stats.Focus - p.Focus;
  const dD = result.stats.Discipline - p.Discipline;
  const dFin = result.stats.Finance - p.Finance;
  const dG = result.stats.Growth - p.Growth;

  console.log(
    `${checkin.date.toISOString().slice(0, 10)}  ${result.nextBioState.overloadLevel}    ${result.stats.Energy.toFixed(1).padStart(6)} ${dE.toFixed(1).padStart(5)}  ${result.stats.Focus.toFixed(1).padStart(6)} ${dF.toFixed(1).padStart(5)}  ${result.stats.Discipline.toFixed(1).padStart(6)} ${dD.toFixed(1).padStart(5)}  ${result.stats.Finance.toFixed(1).padStart(6)} ${dFin.toFixed(1).padStart(5)}  ${result.stats.Growth.toFixed(1).padStart(6)} ${dG.toFixed(1).padStart(5)}`
  );

  prevPrevSnapshot = prevSnapshot;
  prevSnapshot = {
    date: checkin.date,
    stats: result.stats,
    lifeScore: result.lifeScore,
  };
  prevPrevBio = prevBio;
  prevBio = result.nextBioState;
  lifeScoreHistory.push(result.lifeScore);
}

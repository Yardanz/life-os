import { clamp } from "@/lib/scoring/normalize";
import { resolveSystemStatus } from "@/lib/scoring/status";
import {
  FACTOR_NAMES,
  type ContributionFactorName,
  type EngineInput,
  type EngineOutput,
  type OverloadPenaltyLine,
  type StatName,
  type StatVector,
} from "@/lib/scoring/types";

const BASE_DELTA_CAPS: Record<StatName, number> = {
  Energy: 7,
  Focus: 8,
  Discipline: 6,
  Finance: 6,
  Growth: 6,
};

function getDefaultStats(): StatVector {
  return {
    Energy: 50,
    Focus: 50,
    Discipline: 50,
    Finance: 50,
    Growth: 50,
  };
}

function getDefaultBioState() {
  return {
    energyReserve: 50,
    cognitiveFatigue: 30,
    strainIndex: 0,
    overloadLevel: 0 as 0 | 1 | 2,
    recoveryDebt: 0,
    adaptiveCapacity: 50,
    sleepBuffer: 0,
    circadianAlignment: 70,
    sleepRegularity: 70,
    stressLoad: 20,
    trainingBuffer: 0,
    homeostasisBias: 20,
    cognitiveSaturation: 0,
    sympatheticDrive: 40,
    parasympatheticDrive: 40,
    autonomicBalance: 50,
    hormeticSignal: 20,
    overstressSignal: 10,
    burnoutRiskIndex: 15,
    resilienceIndex: 50,
  };
}

function tanh(value: number): number {
  const e2x = Math.exp(2 * value);
  return (e2x - 1) / (e2x + 1);
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function resolveOverloadLevel(
  prevLevel: 0 | 1 | 2,
  strain: number,
  thresholds: {
    level1: number;
    level2: number;
    recover: number;
  }
): 0 | 1 | 2 {
  if (prevLevel === 2) {
    if (strain >= thresholds.recover) return 2;
    if (strain >= thresholds.level1) return 1;
    return 0;
  }

  if (prevLevel === 1) {
    if (strain >= thresholds.level2) return 2;
    if (strain >= thresholds.recover) return 1;
    return 0;
  }

  if (strain >= thresholds.level2) return 2;
  if (strain >= thresholds.level1) return 1;
  return 0;
}

function weightedDiminishingContribution(weight: number, value: number, previousStat: number): {
  rawContribution: number;
  effectiveContribution: number;
} {
  const rawContribution = weight * value;
  const effectiveContribution = rawContribution * (1 - previousStat / 120);
  return { rawContribution, effectiveContribution };
}

function resolveDeltaCapMultiplier(overloadLevel: 0 | 1 | 2): number {
  if (overloadLevel === 2) return 0.65;
  if (overloadLevel >= 1) return 0.8;
  return 1;
}

function compressDelta(delta: number, cap: number): number {
  if (Math.abs(delta) <= cap) return delta;
  return Math.sign(delta) * (cap + (Math.abs(delta) - cap) * 0.35);
}

export function computeDayV3(input: EngineInput): EngineOutput {
  const previousStats = input.previousSnapshot?.stats ?? getDefaultStats();
  const previousBio = input.prevBioState ?? getDefaultBioState();
  const previousPrevBio = input.prevPrevBioState;
  const contributionsMap = new Map<string, EngineOutput["contributions"][number]>();
  const addContribution = (
    stat: StatName,
    factor: ContributionFactorName,
    delta: number,
    rawContribution = 0,
    effectiveContribution = 0,
    momentumContribution = 0
  ) => {
    const key = `${stat}:${factor}`;
    const existing = contributionsMap.get(key);
    if (existing) {
      existing.contribution += delta;
      existing.rawContribution += rawContribution;
      existing.effectiveContribution += effectiveContribution;
      existing.momentumContribution += momentumContribution;
      return;
    }

    contributionsMap.set(key, {
      stat,
      factor,
      lag: 0,
      rawValue: 0,
      weight: 0,
      rawContribution,
      effectiveContribution,
      momentumContribution,
      contribution: delta,
    });
  };

  const S = clamp(input.checkIn.sleepHours / 8, 0, 1) * clamp(input.checkIn.sleepQuality / 5, 0, 1);
  const calibrationEnabled =
    Boolean(input.calibration?.calibrationActive) && (input.calibration?.confidence ?? 0) >= 0.4;
  const multipliers = calibrationEnabled
    ? input.calibration?.multipliers ?? {
        reserveSleepGain: 1,
        focusFromStress: 1,
        workoutStrain: 1,
        circadianRisk: 1,
        debtBurnout: 1,
      }
    : {
        reserveSleepGain: 1,
        focusFromStress: 1,
        workoutStrain: 1,
        circadianRisk: 1,
        debtBurnout: 1,
      };
  const reserveSleepGainEffective = input.config.bio.reserveSleepGain * multipliers.reserveSleepGain;
  const focusFromStressEffective = input.config.bio.focusFromStress * multipliers.focusFromStress;
  const workoutStrainWeight = 0.6 * multipliers.workoutStrain;
  const debtBurnoutWeight = 0.18 * multipliers.debtBurnout;
  const sleepQualityN = clamp(input.checkIn.sleepQuality / 5, 0, 1);
  const W = clamp(input.checkIn.workout, 0, 1);
  const DW = clamp(input.checkIn.deepWorkMin / 120, 0, 1);
  const L = clamp(input.checkIn.learningMin / 60, 0, 1);
  const M = tanh(input.checkIn.moneyDelta / 2000);
  const T = clamp(1 - (input.checkIn.stress - 1) / 9, 0, 1);
  const sleepRegularity = clamp(input.checkIn.sleepRegularity ?? 70, 0, 100);
  const cognitiveSaturation = clamp(input.checkIn.cognitiveSaturation ?? 0, 0, 100);
  const circadianAlignmentPenalty = clamp(input.checkIn.circadianAlignmentPenalty ?? 0, 0, 100);
  const regularityPenalty = clamp(input.checkIn.regularityPenalty ?? 0, 0, 12);
  const regularityScale = sleepRegularity < 35 ? 0.75 : sleepRegularity < 50 ? 0.85 : 1;
  const protocolActive = input.controlLayer?.protocol?.active === true;
  const protocolMode = protocolActive ? input.controlLayer?.protocol?.mode ?? "STANDARD" : null;
  const antiChaosActive = input.controlLayer?.antiChaos?.active === true;
  const antiChaosSeverity = antiChaosActive ? input.controlLayer?.antiChaos?.severity ?? "WARNING" : null;
  const antiChaosDaysSinceActivation = antiChaosActive ? input.controlLayer?.antiChaos?.daysSinceActivation ?? 0 : 0;
  const antiChaosAgeDecay = antiChaosActive ? clamp(1 - antiChaosDaysSinceActivation * 0.08, 0.45, 1) : 0;
  const protocolStabilizationIntensity = protocolActive ? (protocolMode === "STABILIZE" ? 0.14 : 0.08) : 0;
  const antiChaosStabilizationIntensity =
    antiChaosActive ? (antiChaosSeverity === "CRITICAL" ? 0.18 : 0.11) * antiChaosAgeDecay : 0;
  const stabilizationIntensity = clamp(protocolStabilizationIntensity + antiChaosStabilizationIntensity, 0, 0.32);
  const recoveryStreakDays = clamp(Math.round(input.controlLayer?.recoveryPattern?.streakDays ?? 0), 0, 14);
  const recoveryPatternStrength = clamp(input.controlLayer?.recoveryPattern?.strength ?? 0, 0, 1);
  const reboundPhase1 =
    recoveryStreakDays >= 3 ? clamp((recoveryStreakDays - 2) / 2, 0, 1) * recoveryPatternStrength : 0;
  const reboundPhase2 =
    recoveryStreakDays >= 4 ? clamp((recoveryStreakDays - 3) / 2.5, 0, 1) * recoveryPatternStrength : 0;
  const reboundPhase3 =
    recoveryStreakDays >= 6 ? clamp((recoveryStreakDays - 5) / 3, 0, 1) * recoveryPatternStrength : 0;
  const sustainedRecoverySignal =
    recoveryStreakDays >= 3
      ? clamp((recoveryStreakDays - 2) / 5, 0, 1) * clamp((recoveryPatternStrength - 0.35) / 0.65, 0, 1)
      : 0;
  const reboundIntensity = clamp(
    reboundPhase1 * 0.08 + reboundPhase2 * 0.11 + reboundPhase3 * 0.14 + sustainedRecoverySignal * 0.1,
    0,
    0.3
  );
  const totalStabilizationIntensity = clamp(stabilizationIntensity + reboundIntensity, 0, 0.52);

  const baseLoad = clamp(0.6 * DW + 0.4 * L + workoutStrainWeight * W, 0, 1);
  const load = clamp(baseLoad * (1 - totalStabilizationIntensity * 0.12), 0, 1);
  const recovery = clamp(0.7 * S + 0.3 * T, 0, 1);
  const recoveryLoadSurplus = clamp(recovery - load, -1, 1);
  const baselineRecoverySupport = clamp(
    Math.max(0, recoveryLoadSurplus) * 0.6 + Math.max(0, T - 0.55) * 0.25 + Math.max(0, S - 0.65) * 0.15,
    0,
    1
  );
  const stressN = clamp((input.checkIn.stress - 1) / 9, 0, 1);
  const prevStrainN = clamp(previousBio.strainIndex / 100, 0, 1);
  const fatigueN = clamp(previousBio.cognitiveFatigue / 100, 0, 1);
  const circadianN = clamp(previousBio.circadianAlignment / 100, 0, 1);
  const loadRecoveryGapAbs = Math.abs(load - recovery);
  const homeostasisNext = clamp(previousBio.homeostasisBias * 0.8 + loadRecoveryGapAbs * 100 * 0.2, 0, 100);
  const lifeScoreTrend =
    typeof input.lifeScoreTrend === "number"
      ? input.lifeScoreTrend
      : input.previousLifeScores.length >= 6
        ? input.previousLifeScores.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3 -
          input.previousLifeScores.slice(3, 6).reduce((sum, value) => sum + value, 0) / 3
        : 0;

  const nextStressLoad = clamp(
    previousBio.stressLoad * input.config.bio.stressCarry +
      stressN * 100 * input.config.bio.stressGain -
      recovery * 100 * input.config.bio.stressRecovery -
      totalStabilizationIntensity * (6 + recovery * 6) -
      (reboundPhase1 * 1 + reboundPhase2 * 2 + reboundPhase3 * 3) -
      sustainedRecoverySignal * (2 + Math.max(0, recoveryLoadSurplus) * 3),
    0,
    100
  );
  const stressLoadN = clamp(nextStressLoad / 100, 0, 1);

  const stableAlignmentBoost = circadianAlignmentPenalty < 2 ? 1.5 : 0;
  const irregularAlignmentPenalty =
    (circadianAlignmentPenalty > 4 ? (circadianAlignmentPenalty - 4) * 0.06 : 0) +
    regularityPenalty * 0.04;

  const sympNextRaw = clamp(
    previousBio.sympatheticDrive * input.config.bio.sympCarry +
      stressN * 100 * input.config.bio.sympFromStress +
      load * 100 * input.config.bio.sympFromLoad +
      prevStrainN * 100 * input.config.bio.sympFromStrain,
    0,
    100
  );
  const paraNextRaw = clamp(
    previousBio.parasympatheticDrive * input.config.bio.paraCarry +
      sleepQualityN * 100 * input.config.bio.paraFromSleep +
      recovery * 100 * input.config.bio.paraFromRecovery +
      circadianN * 100 * input.config.bio.paraFromCircadian -
      stressLoadN * 100 * input.config.bio.paraSuppressedByStressLoad,
    0,
    100
  );
  const sympNext = clamp(sympNextRaw + irregularAlignmentPenalty - stableAlignmentBoost * 0.5, 0, 100);
  const paraNext = clamp(paraNextRaw + stableAlignmentBoost - irregularAlignmentPenalty, 0, 100);
  const autonomicBalance = clamp(50 + (paraNext - sympNext) * 0.5, 0, 100);
  const sleepRecoveryMultFromStress = clamp(1 - (nextStressLoad / 100) * 0.18, 0.75, 1);
  const sleepRecoveryMultAutonomic = clamp(1 + (paraNext - 50) / 200 - (sympNext - 50) / 250, 0.75, 1.25);
  const sleepRecoveryMult = clamp(sleepRecoveryMultFromStress * sleepRecoveryMultAutonomic, 0.75, 1.25);
  const fatigueMult = clamp(1 + (sympNext - 50) / 200 - (paraNext - 50) / 250, 0.8, 1.3);

  const trainingBufferPrev = clamp(previousBio.trainingBuffer, 0, 100);
  const trainingBufferSpent = Math.min(trainingBufferPrev, input.config.bio.trainingSpendMax);
  const trainingBufferIn = W > 0 ? input.config.bio.trainingIn : 0;
  const trainingBufferNext = clamp(
    trainingBufferPrev * input.config.bio.trainingCarry + trainingBufferIn - trainingBufferSpent,
    0,
    100
  );
  const trainingReserveBonus = trainingBufferSpent * input.config.bio.trainingReserveBonus;
  const trainingDisciplineBonus = trainingBufferSpent * input.config.bio.trainingDisciplineBonus;
  const trainingAdaptiveBonus = trainingBufferSpent * input.config.bio.trainingAdaptiveBonus;
  const workoutReserveCost = W * input.config.bio.workoutSameDayCostReserve;
  const workoutFatigueCost = W * input.config.bio.workoutSameDayCostFatigue;

  const reserveGainBase = reserveSleepGainEffective * S * 100;
  const reserveGain = reserveGainBase * regularityScale;
  const reserveGainEffective = reserveGain * sleepRecoveryMult;
  const reserveLoss =
    input.config.bio.reserveWorkCost * DW * 100 + input.config.bio.reserveStressCost * (1 - T) * 100;
  const reserveAfterBase = clamp(previousBio.energyReserve + reserveGainEffective - reserveLoss, 0, 100);

  const adaptiveScale = clamp(previousBio.adaptiveCapacity / 100, 0, 1);
  const sleepBufferPrev = clamp(previousBio.sleepBuffer, 0, 100);
  const sleepBufferSpent = Math.min(sleepBufferPrev, input.config.bio.bufferSpendMax);
  const reserveBonus = sleepBufferSpent * input.config.bio.reserveFromBuffer;
  const fatigueBonusPlanned = sleepBufferSpent * input.config.bio.fatigueFromBuffer;
  const sleepBufferIn = S * 100 * input.config.bio.bufferGain;
  const sleepBufferNext = clamp(
    sleepBufferPrev * input.config.bio.bufferCarry + sleepBufferIn - sleepBufferSpent,
    0,
    100
  );
  const nextReserve = clamp(reserveAfterBase + reserveBonus + trainingReserveBonus - workoutReserveCost, 0, 100);

  const sleepDeficit = Math.max(0, 1 - S);
  const imbalance = Math.max(0, load - recovery);
  const debtIncrease = (sleepDeficit * 0.6 + imbalance * 0.4) * 100 * (1 - totalStabilizationIntensity * 0.18);
  const debtCarryRelief = baselineRecoverySupport * 0.06;
  const debtCarryEffective = clamp(
    input.config.bio.debtCarry - debtCarryRelief - sustainedRecoverySignal * 0.06,
    0.76,
    input.config.bio.debtCarry
  );
  const debtRecovery =
    S *
    input.config.bio.debtRecoveryFactor *
    (1 +
      Math.max(0, recoveryLoadSurplus) * 0.25 +
      Math.max(0, T - 0.55) * 0.15 +
      totalStabilizationIntensity * (0.25 + Math.max(0, recoveryLoadSurplus) * 0.2) +
      reboundPhase1 * 0.08 +
      reboundPhase2 * 0.14 +
      reboundPhase3 * 0.2 +
      sustainedRecoverySignal * 0.28);
  let nextRecoveryDebt = clamp(
    previousBio.recoveryDebt * debtCarryEffective + debtIncrease - debtRecovery,
    0,
    100
  );

  const saturationOver60 = Math.max(0, cognitiveSaturation - 60);
  const baseFatigueIncrease =
    input.config.bio.fatigueWorkGain * DW * 100 +
    input.config.bio.fatigueStressGain * (1 - T) * 100 +
    nextStressLoad * 0.1 +
    workoutFatigueCost +
    saturationOver60 * 0.2;
  const fatigueIncrease = baseFatigueIncrease * fatigueMult;
  let fatigueRecovery = input.config.bio.fatigueSleepRecovery * S * 100 * regularityScale;
  fatigueRecovery *= sleepRecoveryMult;
  const adaptiveRecoverySupport = clamp(baselineRecoverySupport * 0.35 + Math.max(0, recoveryLoadSurplus) * 0.1, 0, 0.4);
  const effectiveAdaptiveScale = clamp(adaptiveScale + adaptiveRecoverySupport, 0, 1);
  fatigueRecovery *= effectiveAdaptiveScale;
  if (nextRecoveryDebt > 60) fatigueRecovery *= 0.75;
  if (homeostasisNext > 60) fatigueRecovery = Math.max(0, fatigueRecovery - homeostasisNext * 0.08);
  if (lifeScoreTrend < -3) fatigueRecovery *= 0.9;
  const fatigueAfterBase = clamp(
    previousBio.cognitiveFatigue * input.config.bio.fatigueCarry + fatigueIncrease - fatigueRecovery,
    0,
    100
  );
  let nextFatigue = clamp(fatigueAfterBase - fatigueBonusPlanned, 0, 100);
  const fatigueBonusApplied = fatigueAfterBase - nextFatigue;

  const strainImbalance = clamp(load - recovery, 0, 1);
  const strainBeforeStabilization = clamp(
    previousBio.strainIndex * input.config.bio.strainCarry +
      strainImbalance * 100 +
      (nextFatigue / 100) * input.config.bio.strainFatigueWeight * 100,
    0,
    100
  );
  const strainReduction =
    sleepBufferSpent * 0.2 +
    totalStabilizationIntensity * (4 + Math.max(0, recoveryLoadSurplus) * 6 + Math.max(0, T - 0.5) * 2) +
    reboundPhase2 * 1.5 +
    reboundPhase3 * 2.5 +
    sustainedRecoverySignal * 2;
  const nextStrain = clamp(strainBeforeStabilization - strainReduction, 0, 100);
  const strainN = clamp(nextStrain / 100, 0, 1);
  const loadN = clamp(load, 0, 1);
  const recoveryN = clamp(recovery, 0, 1);
  const autonomicBalanceN = clamp(autonomicBalance / 100, 0, 1);
  const effectiveLoad = clamp(loadN + 0.15 * W, 0, 1);
  const hormeticInWindow = effectiveLoad >= 0.35 && effectiveLoad <= 0.65;
  const hormesisInput =
    hormeticInWindow && recoveryN >= 0.4 && stressN <= 0.75 && strainN <= 0.55 && autonomicBalanceN >= 0.35
      ? clamp(1 - Math.abs(effectiveLoad - 0.5) / 0.15, 0, 1)
      : 0;
  const overstressInput =
    Math.max(0, effectiveLoad - 0.7) + Math.max(0, stressN - 0.75) + Math.max(0, strainN - 0.6);
  const hormeticNext = clamp(previousBio.hormeticSignal * 0.75 + hormesisInput * 100 * 0.6, 0, 100);
  const overstressNext = clamp(
    previousBio.overstressSignal * 0.8 +
      overstressInput * 100 * 0.7 -
      totalStabilizationIntensity * (3 + Math.max(0, recoveryLoadSurplus) * 4) -
      sustainedRecoverySignal * (2.5 + Math.max(0, recoveryLoadSurplus) * 3),
    0,
    100
  );

  const overloadLevel = resolveOverloadLevel(previousBio.overloadLevel, nextStrain, {
    level1: input.config.bio.overloadLevel1Threshold,
    level2: input.config.bio.overloadLevel2Threshold,
    recover: input.config.bio.overloadRecoverThreshold,
  });

  const prevAlignment = clamp(previousBio.circadianAlignment, 0, 100);
  const stressPenalty = ((input.checkIn.stress - 1) / 9) * 100;
  const strainPenalty = nextStrain;
  const alignmentNext = clamp(
    prevAlignment * 0.85 +
      sleepRegularity * 0.1 +
      recovery * 100 * 0.05 -
      stressPenalty * 0.08 -
      strainPenalty * 0.06 -
      circadianAlignmentPenalty * 0.15,
    0,
    100
  );
  const circadianFocusPenalty = 0.5 * circadianAlignmentPenalty;
  const circadianEnergyPenalty = 0.6 * circadianAlignmentPenalty;
  const saturationFocusPenalty = saturationOver60 * 0.4;
  const autonomicRecoveryEdge = clamp((paraNext - sympNext) / 100, -1, 1);
  const circadianRecoveryEdge = clamp((alignmentNext - 55) / 45, -1, 1);
  const debtReleaseSignal = clamp(
    baselineRecoverySupport * 0.45 +
      Math.max(0, autonomicRecoveryEdge) * 0.25 +
      Math.max(0, circadianRecoveryEdge) * 0.15 +
      Math.max(0, 0.65 - stressN) * 0.15,
    0,
    1
  );
  const debtReleaseMagnitude =
    previousBio.recoveryDebt >= 75
      ? 8 + sustainedRecoverySignal * 3
      : previousBio.recoveryDebt >= 55
        ? 5 + sustainedRecoverySignal * 2.4
        : previousBio.recoveryDebt >= 35
          ? 3 + sustainedRecoverySignal * 1.6
          : 1.5 + sustainedRecoverySignal;
  const debtRelease = debtReleaseSignal * debtReleaseMagnitude;

  const sympFocusBoost = sympNext > 70 && fatigueN < 0.6 ? (sympNext - 70) * 0.15 : 0;
  if (sympFocusBoost > 0) {
    const sympatheticDebtPenalty = (sympNext - 70) * 0.1 * (1 - Math.max(0, recoveryLoadSurplus) * 0.35);
    nextRecoveryDebt = clamp(nextRecoveryDebt + sympatheticDebtPenalty, 0, 100);
  }
  nextRecoveryDebt = clamp(
    nextRecoveryDebt +
      overstressNext * 0.05 -
      hormeticNext * 0.03 -
      debtRelease -
      sustainedRecoverySignal * (previousBio.recoveryDebt >= 70 ? 4.5 : previousBio.recoveryDebt >= 50 ? 2.8 : 1.2),
    0,
    100
  );

  const sympN = clamp(sympNext / 100, 0, 1);
  const paraN = clamp(paraNext / 100, 0, 1);
  const recoveryDebtN = clamp(nextRecoveryDebt / 100, 0, 1);
  const circadianDriftN = clamp(1 - alignmentNext / 100, 0, 1);
  const saturationN = clamp(cognitiveSaturation / 100, 0, 1);
  const hormesisN = clamp(hormeticNext / 100, 0, 1);
  const overstressN = clamp(overstressNext / 100, 0, 1);

  const burnoutPressure =
    0.22 * sympN +
    0.18 * stressLoadN +
    debtBurnoutWeight * recoveryDebtN +
    0.16 * strainN +
    0.12 * circadianDriftN +
    0.14 * saturationN +
    0.1 * overstressN -
    0.1 * hormesisN -
    0.14 * paraN;
  const burnoutRecoverySignal = clamp(
    baselineRecoverySupport * 0.45 +
      Math.max(0, autonomicRecoveryEdge) * 0.2 +
      Math.max(0, circadianRecoveryEdge) * 0.15 +
      Math.max(0, previousBio.resilienceIndex / 100 - 0.45) * 0.2,
    0,
    1
  );
  const burnoutRecoveryBrake =
    burnoutRecoverySignal *
    (previousBio.burnoutRiskIndex >= 80 ? 8 : previousBio.burnoutRiskIndex >= 60 ? 5 : previousBio.burnoutRiskIndex >= 40 ? 3 : 1.5);
  const burnoutStabilizationRelief =
    totalStabilizationIntensity * (4 + recoveryN * 6 + Math.max(0, 1 - stressN) * 2) +
    reboundPhase2 * 2 +
    reboundPhase3 * 3 +
    sustainedRecoverySignal * 3.5;
  const burnoutCarry =
    previousBio.burnoutRiskIndex *
    clamp(0.85 - sustainedRecoverySignal * 0.07 - reboundPhase3 * 0.03, 0.72, 0.86);
  const burnoutNext = clamp(
    burnoutCarry +
      burnoutPressure * 100 * 0.35 -
      previousBio.resilienceIndex * 0.12 -
      burnoutRecoveryBrake -
      burnoutStabilizationRelief,
    0,
    100
  );

  const resilienceGain =
    0.3 * paraN +
    0.25 * (1 - stressLoadN) +
    0.2 * (1 - recoveryDebtN) +
    0.15 * clamp(alignmentNext / 100, 0, 1) +
    0.1 * hormesisN;
  const resilienceRecoverySignal = clamp(
    baselineRecoverySupport * 0.45 +
      Math.max(0, autonomicRecoveryEdge) * 0.25 +
      Math.max(0, circadianRecoveryEdge) * 0.15 +
      Math.max(0, 1 - recoveryDebtN - 0.25) * 0.15,
    0,
    1
  );
  const resilienceRecoveryBoost =
    resilienceRecoverySignal *
    (previousBio.resilienceIndex <= 25
      ? 7
      : previousBio.resilienceIndex <= 45
        ? 4.5
        : previousBio.resilienceIndex <= 65
          ? 2.5
          : 1.2);
  const overstressResiliencePenaltyScale = previousBio.resilienceIndex <= 20 ? 0.8 : previousBio.resilienceIndex <= 35 ? 0.9 : 1;
  const resilienceStabilizationBonus =
    totalStabilizationIntensity * (3 + recoveryN * 4 + Math.max(0, T - 0.55) * 2 + Math.max(0, recoveryLoadSurplus) * 3) +
    reboundPhase1 * 1 +
    reboundPhase2 * 2 +
    reboundPhase3 * 3 +
    sustainedRecoverySignal * 2;
  const resilienceNext = clamp(
    previousBio.resilienceIndex * 0.88 +
      resilienceGain * 100 * 0.25 -
      overstressN * 100 * 0.1 * overstressResiliencePenaltyScale +
      resilienceRecoveryBoost +
      resilienceStabilizationBonus,
    0,
    100
  );

  const burnoutFatigueCarryPenalty = burnoutNext >= 65 ? previousBio.cognitiveFatigue * 0.03 : 0;
  const resilienceFatigueRecoveryBonus = resilienceNext >= 70 ? fatigueRecovery * 0.08 : 0;
  nextFatigue = clamp(nextFatigue + burnoutFatigueCarryPenalty - resilienceFatigueRecoveryBonus, 0, 100);

  const burnoutCapPenalty = burnoutNext >= 65 ? 8 : 0;
  const debtEnergyCapPenalty = nextRecoveryDebt > 70 ? 10 : 0;
  const energyCap = clamp(
    (overloadLevel === 2 ? 75 : overloadLevel === 1 ? 90 : 100) - debtEnergyCapPenalty - burnoutCapPenalty,
    0,
    100
  );
  const uncappedEnergy = clamp(nextReserve * 0.9 + (100 - nextFatigue) * 0.1, 0, 100);
  const Energy = clamp(uncappedEnergy - circadianEnergyPenalty, 0, energyCap);
  const burnoutFocusPenalty = burnoutNext >= 65 ? (burnoutNext - 65) * 0.25 : 0;

  const Focus = clamp(
    input.config.bio.baseFocus +
      input.config.bio.focusFromEnergy * (Energy - 50) -
      input.config.bio.focusFromFatigue * (nextFatigue - 30) -
      focusFromStressEffective * ((1 - T) * 50) -
      nextRecoveryDebt * 0.15 -
      circadianFocusPenalty -
      nextStressLoad * 0.12 -
      saturationFocusPenalty +
      sympFocusBoost -
      burnoutFocusPenalty,
    0,
    100
  );

  const prevDiscipline = previousStats.Discipline;
  const inOptimalWindow = load >= input.config.bio.optLoadMin && load <= input.config.bio.optLoadMax;
  const adaptiveGain =
    inOptimalWindow && overloadLevel === 0 ? input.config.bio.adaptGain * load * 100 * adaptiveScale : 0;
  const burnoutPenalty =
    overloadLevel >= 1 ? input.config.bio.burnoutPenalty * (nextStrain / 100) * 100 : 0;
  const disciplineBase =
    prevDiscipline * input.config.bio.disciplineCarry + (1 - input.config.bio.disciplineCarry) * 50;
  const hormeticDisciplineDelta = hormeticNext * 0.05 - overstressNext * 0.06;
  const Discipline = clamp(
    disciplineBase + adaptiveGain - burnoutPenalty + trainingDisciplineBonus + hormeticDisciplineDelta,
    0,
    100
  );

  const adaptiveDelta =
    inOptimalWindow && overloadLevel === 0
      ? input.config.bio.adaptGain * 10
      : overloadLevel >= 1
        ? -input.config.bio.burnoutPenalty *
          15 *
          (previousBio.adaptiveCapacity < 20 ? 0.75 : previousBio.adaptiveCapacity < 35 ? 0.85 : 1) *
          (1 - totalStabilizationIntensity * 0.45)
        : 0;
  let nextAdaptiveCapacity = clamp(
    previousBio.adaptiveCapacity * input.config.bio.adaptiveCarry + adaptiveDelta,
    0,
    100
  );
  if (homeostasisNext > 60) nextAdaptiveCapacity = clamp(nextAdaptiveCapacity - homeostasisNext * 0.05, 0, 100);
  if (homeostasisNext < 25 && loadRecoveryGapAbs <= 0.1) nextAdaptiveCapacity = clamp(nextAdaptiveCapacity + 2, 0, 100);
  nextAdaptiveCapacity = clamp(nextAdaptiveCapacity + hormeticNext * 0.06 - overstressNext * 0.08, 0, 100);
  const adaptiveRecoverySignal = clamp(
    baselineRecoverySupport * 0.45 +
      Math.max(0, autonomicRecoveryEdge) * 0.2 +
      Math.max(0, circadianRecoveryEdge) * 0.15 +
      Math.max(0, 0.7 - stressN) * 0.2,
    0,
    1
  );
  const adaptiveRecoveryBoost =
    adaptiveRecoverySignal *
    (previousBio.adaptiveCapacity <= 20
      ? 6
      : previousBio.adaptiveCapacity <= 40
        ? 4
        : previousBio.adaptiveCapacity <= 60
          ? 2.5
          : 1.2);
  const adaptiveStabilizationBoost =
    totalStabilizationIntensity * (2 + Math.max(0, recoveryLoadSurplus) * 5 + Math.max(0, T - 0.55) * 2) +
    reboundPhase2 * 1.5 +
    reboundPhase3 * 2.5 +
    sustainedRecoverySignal * 2.2;
  nextAdaptiveCapacity = clamp(nextAdaptiveCapacity + adaptiveRecoveryBoost + adaptiveStabilizationBoost, 0, 100);
  const nextAdaptiveCapacityStabilized =
    sleepBufferSpent > 0 && overloadLevel === 0 ? clamp(nextAdaptiveCapacity + sleepBufferSpent * 0.05, 0, 100) : nextAdaptiveCapacity;
  let nextAdaptiveCapacityDelayed = clamp(nextAdaptiveCapacityStabilized + trainingAdaptiveBonus, 0, 100);
  if (lifeScoreTrend > 3) nextAdaptiveCapacityDelayed = clamp(nextAdaptiveCapacityDelayed + 3, 0, 100);

  const financeFactors: Record<(typeof FACTOR_NAMES)[number], number> = {
    S,
    W,
    DW,
    L,
    M,
    T,
  };

  const financeContribution = FACTOR_NAMES.reduce((sum, factor) => {
    const cfg = input.config.factors.Finance[factor];
    const { effectiveContribution } = weightedDiminishingContribution(cfg.weight, financeFactors[factor], previousStats.Finance);
    return sum + effectiveContribution;
  }, 0);

  const growthContribution = FACTOR_NAMES.reduce((sum, factor) => {
    const cfg = input.config.factors.Growth[factor];
    const { effectiveContribution } = weightedDiminishingContribution(cfg.weight, financeFactors[factor], previousStats.Growth);
    return sum + effectiveContribution;
  }, 0);

  const Finance = clamp(previousStats.Finance * (1 - input.config.decay.Finance) + financeContribution, 0, 100);
  const Growth = clamp(previousStats.Growth * (1 - input.config.decay.Growth) + growthContribution, 0, 100);

  const rawNextStats: StatVector = {
    Energy,
    Focus,
    Discipline,
    Finance,
    Growth,
  };

  const sleepToEnergy = reserveGainEffective * 0.9 + fatigueRecovery * 0.1;
  const deepWorkToEnergy = -(input.config.bio.reserveWorkCost * DW * 100);
  const stressToEnergy = -(input.config.bio.reserveStressCost * (1 - T) * 100);
  const delayedSleepToEnergy = reserveBonus;
  const stressResidualToEnergy = -(reserveGain - reserveGainEffective);
  const autonomicEnergyEffect = reserveGain * (sleepRecoveryMultAutonomic - 1);
  const delayedTrainingToEnergy = trainingReserveBonus;
  const workoutCostToEnergy = -workoutReserveCost;
  const capPenalty = uncappedEnergy > energyCap ? uncappedEnergy - energyCap : 0;

  addContribution("Energy", "S", sleepToEnergy, reserveGain, sleepToEnergy);
  if (delayedSleepToEnergy > 0) {
    addContribution("Energy", "S", delayedSleepToEnergy, delayedSleepToEnergy, delayedSleepToEnergy);
  }
  if (stressResidualToEnergy !== 0) {
    addContribution("Energy", "T", stressResidualToEnergy, stressResidualToEnergy, stressResidualToEnergy);
  }
  if (autonomicEnergyEffect !== 0) {
    addContribution("Energy", "OVERLOAD", autonomicEnergyEffect, autonomicEnergyEffect, autonomicEnergyEffect);
  }
  if (delayedTrainingToEnergy > 0) {
    addContribution("Energy", "W", delayedTrainingToEnergy, delayedTrainingToEnergy, delayedTrainingToEnergy);
  }
  if (workoutCostToEnergy !== 0) {
    addContribution("Energy", "W", workoutCostToEnergy, workoutCostToEnergy, workoutCostToEnergy);
  }
  addContribution("Energy", "DW", deepWorkToEnergy, deepWorkToEnergy, deepWorkToEnergy);
  addContribution("Energy", "T", stressToEnergy, stressToEnergy, stressToEnergy);
  if (capPenalty > 0) addContribution("Energy", "OVERLOAD", -capPenalty, -capPenalty, -capPenalty);

  const reserveToFocus = input.config.bio.focusFromEnergy * (nextReserve - previousBio.energyReserve);
  const fatigueToFocusBase = -input.config.bio.focusFromFatigue * (fatigueAfterBase - previousBio.cognitiveFatigue);
  const fatigueToFocusDelayed = input.config.bio.focusFromFatigue * fatigueBonusApplied;
  const stressToFocus = -focusFromStressEffective * ((1 - T) * 50);
  const debtToFocus = -nextRecoveryDebt * 0.15;
  const circadianToFocus = -circadianFocusPenalty;
  const circadianToEnergy = -circadianEnergyPenalty;
  const stressResidualToFocus = -nextStressLoad * 0.12;
  const saturationToFocus = -saturationFocusPenalty;
  const autonomicFocusEffect = sympFocusBoost;
  const overloadToFocus = overloadLevel > 0 ? -overloadLevel * 1.5 : 0;

  addContribution("Focus", "S", reserveToFocus, reserveToFocus, reserveToFocus);
  addContribution("Focus", "DW", fatigueToFocusBase, fatigueToFocusBase, fatigueToFocusBase);
  if (fatigueToFocusDelayed !== 0) {
    addContribution("Focus", "S", fatigueToFocusDelayed, fatigueToFocusDelayed, fatigueToFocusDelayed);
  }
  addContribution("Focus", "T", stressToFocus, stressToFocus, stressToFocus);
  if (debtToFocus !== 0) addContribution("Focus", "OVERLOAD", debtToFocus, debtToFocus, debtToFocus);
  if (circadianToFocus !== 0) addContribution("Focus", "OVERLOAD", circadianToFocus, circadianToFocus, circadianToFocus);
  if (circadianToEnergy !== 0) addContribution("Energy", "S", circadianToEnergy, circadianToEnergy, circadianToEnergy);
  if (stressResidualToFocus !== 0) addContribution("Focus", "T", stressResidualToFocus, stressResidualToFocus, stressResidualToFocus);
  if (saturationToFocus !== 0) addContribution("Focus", "DW", saturationToFocus, saturationToFocus, saturationToFocus);
  if (autonomicFocusEffect !== 0) {
    addContribution("Focus", "OVERLOAD", autonomicFocusEffect, autonomicFocusEffect, autonomicFocusEffect);
  }
  if (burnoutFocusPenalty > 0) {
    addContribution("Focus", "OVERLOAD", -burnoutFocusPenalty, -burnoutFocusPenalty, -burnoutFocusPenalty);
  }
  if (overloadToFocus !== 0) addContribution("Focus", "OVERLOAD", overloadToFocus, overloadToFocus, overloadToFocus);

  addContribution("Discipline", "DW", adaptiveGain, adaptiveGain, adaptiveGain);
  addContribution("Discipline", "W", W * 1.2, W * 1.2, W * 1.2);
  if (trainingDisciplineBonus > 0) {
    addContribution("Discipline", "W", trainingDisciplineBonus, trainingDisciplineBonus, trainingDisciplineBonus);
  }
  if (burnoutPenalty > 0) addContribution("Discipline", "OVERLOAD", -burnoutPenalty, -burnoutPenalty, -burnoutPenalty);
  if (hormeticDisciplineDelta !== 0) {
    addContribution("Discipline", "OVERLOAD", hormeticDisciplineDelta, hormeticDisciplineDelta, hormeticDisciplineDelta);
  }

  FACTOR_NAMES.forEach((factor) => {
    const financeCfg = input.config.factors.Finance[factor];
    const growthCfg = input.config.factors.Growth[factor];
    const factorValue = financeFactors[factor];

    const financePart = weightedDiminishingContribution(financeCfg.weight, factorValue, previousStats.Finance);
    addContribution("Finance", factor, financePart.effectiveContribution, financePart.rawContribution, financePart.effectiveContribution);

    const growthPart = weightedDiminishingContribution(growthCfg.weight, factorValue, previousStats.Growth);
    addContribution("Growth", factor, growthPart.effectiveContribution, growthPart.rawContribution, growthPart.effectiveContribution);
  });

  const capMultiplier = resolveDeltaCapMultiplier(overloadLevel);
  const adjustedCaps: Record<StatName, number> = {
    Energy: BASE_DELTA_CAPS.Energy * capMultiplier,
    Focus: BASE_DELTA_CAPS.Focus * capMultiplier,
    Discipline: BASE_DELTA_CAPS.Discipline * capMultiplier,
    Finance: BASE_DELTA_CAPS.Finance * capMultiplier,
    Growth: BASE_DELTA_CAPS.Growth * capMultiplier,
  };
  const nextStats: StatVector = { ...rawNextStats };

  (Object.keys(rawNextStats) as StatName[]).forEach((stat) => {
    const previousValue = previousStats[stat];
    const rawValue = rawNextStats[stat];
    const rawDelta = rawValue - previousValue;
    const compressedDelta = compressDelta(rawDelta, adjustedCaps[stat]);

    if (Math.abs(compressedDelta - rawDelta) < 0.001) return;

    const compressedValue = clamp(previousValue + compressedDelta, 0, 100);
    nextStats[stat] = compressedValue;
    const finalDelta = compressedValue - previousValue;
    const compressionContribution = finalDelta - rawDelta;

    if (Math.abs(compressionContribution) >= 0.001) {
      addContribution(
        stat,
        "OVERLOAD",
        compressionContribution,
        compressionContribution,
        compressionContribution
      );
    }
  });

  const lifeScore =
    (nextStats.Energy + nextStats.Focus + nextStats.Discipline + nextStats.Finance + nextStats.Growth) / 5;

  const reserve = clamp(nextReserve / 100, 0, 1);
  const fatigue = clamp(nextFatigue / 100, 0, 1);
  const strain = strainN;
  const recoverySurplus = clamp(recoveryN - loadN, -1, 1);

  const pressure =
    0.35 * (1 - reserve) +
    0.3 * fatigue +
    0.25 * strain +
    0.2 * stressN -
    0.25 * Math.max(0, recoverySurplus);

  let risk = sigmoid((pressure - 0.35) * 6) * 100;
  if (overloadLevel === 1) risk += 10;
  if (overloadLevel === 2) risk += 20;
  risk -= sleepBufferSpent * 0.15;
  const circadianRiskPenaltyBase =
    input.checkIn.stress >= 6 || nextStressLoad >= 55
      ? 0.8 * circadianAlignmentPenalty
      : 0.4 * circadianAlignmentPenalty;
  const circadianRiskPenalty = circadianRiskPenaltyBase * multipliers.circadianRisk;
  risk += circadianRiskPenalty;
  risk += nextStressLoad * 0.1;
  risk += Math.max(0, (sympNext - 60) * 0.25);
  risk -= Math.max(0, (paraNext - 60) * 0.2);
  risk += overstressNext * 0.1;
  risk -= hormeticNext * 0.06;
  if (resilienceNext >= 70) risk -= 8;
  if (lifeScoreTrend > 3) risk -= 5;
  if (lifeScoreTrend < -3) risk += 6;
  risk -=
    totalStabilizationIntensity * (6 + Math.max(0, recoverySurplus) * 10) +
    reboundPhase2 * 2 +
    reboundPhase3 * 3 +
    sustainedRecoverySignal * (3 + Math.max(0, recoverySurplus) * 4);
  risk = clamp(risk, 0, 100);

  const autonomicFatigueEffect = fatigueIncrease - baseFatigueIncrease;
  if (autonomicFatigueEffect !== 0) {
    addContribution("Focus", "OVERLOAD", -autonomicFatigueEffect * input.config.bio.focusFromFatigue, 0, 0);
  }
  const autonomicRiskEffect =
    Math.max(0, (sympNext - 60) * 0.25) - Math.max(0, (paraNext - 60) * 0.2);
  if (autonomicRiskEffect !== 0) {
    addContribution("Energy", "OVERLOAD", -autonomicRiskEffect * 0.1, 0, 0);
  }
  const hormeticRiskEffect = overstressNext * 0.1 - hormeticNext * 0.06;
  if (hormeticRiskEffect !== 0) {
    addContribution("Energy", "OVERLOAD", -hormeticRiskEffect * 0.1, 0, 0);
  }
  if (circadianRiskPenalty !== 0) {
    addContribution("Focus", "OVERLOAD", -circadianRiskPenalty * 0.1, 0, 0);
  }

  if (previousPrevBio) {
    const reserveMomentum = (previousBio.energyReserve - previousPrevBio.energyReserve) * input.config.momentumWeight;
    const fatigueMomentum =
      (previousBio.cognitiveFatigue - previousPrevBio.cognitiveFatigue) * input.config.momentumWeight;
    addContribution("Energy", "MOMENTUM", reserveMomentum, 0, 0, reserveMomentum);
    addContribution("Focus", "MOMENTUM", -fatigueMomentum, 0, 0, -fatigueMomentum);
  }

  const statusResult = resolveSystemStatus({
    currentLifeScore: lifeScore,
    previousLifeScores: input.previousLifeScores,
    trendDelta: input.config.trendDelta,
    currentStats: nextStats,
    previousStats,
    load,
    stress: input.checkIn.stress,
  });

  return {
    nextBioState: {
      date: input.checkIn.date,
      energyReserve: nextReserve,
      cognitiveFatigue: nextFatigue,
      strainIndex: nextStrain,
      overloadLevel,
      recoveryDebt: nextRecoveryDebt,
      adaptiveCapacity: nextAdaptiveCapacityDelayed,
      sleepBuffer: sleepBufferNext,
      circadianAlignment: alignmentNext,
      sleepRegularity,
      stressLoad: nextStressLoad,
      trainingBuffer: trainingBufferNext,
      homeostasisBias: homeostasisNext,
      cognitiveSaturation,
      sympatheticDrive: sympNext,
      parasympatheticDrive: paraNext,
      autonomicBalance,
      hormeticSignal: hormeticNext,
      overstressSignal: overstressNext,
      burnoutRiskIndex: burnoutNext,
      resilienceIndex: resilienceNext,
    },
    stats: nextStats,
    lifeScore,
    load,
    recovery,
    risk,
    overload: nextStrain,
    status: statusResult.status,
    trend: statusResult.trend,
    contributions: Array.from(contributionsMap.values()),
    overloadPenalties: [] as OverloadPenaltyLine[],
    configVersion: input.config.configVersion,
  };
}

export function calculateDayScore(input: EngineInput): EngineOutput {
  return computeDayV3(input);
}

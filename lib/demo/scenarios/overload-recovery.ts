export type DemoCheckinInput = {
  day: number;
  label: string;
  sleepHours: number;
  sleepQuality: number;
  deepWorkMinutes: number;
  learningMinutes: number;
  stress: number;
  workout: boolean;
  moneyDelta: number;
};

export const OVERLOAD_RECOVERY_SCENARIO: DemoCheckinInput[] = [
  {
    day: 1,
    label: "Day 1",
    sleepHours: 6.1,
    sleepQuality: 5,
    deepWorkMinutes: 170,
    learningMinutes: 70,
    stress: 7,
    workout: true,
    moneyDelta: 0,
  },
  {
    day: 2,
    label: "Day 2",
    sleepHours: 5.8,
    sleepQuality: 4,
    deepWorkMinutes: 185,
    learningMinutes: 60,
    stress: 8,
    workout: true,
    moneyDelta: 0,
  },
  {
    day: 3,
    label: "Day 3",
    sleepHours: 5.6,
    sleepQuality: 4,
    deepWorkMinutes: 195,
    learningMinutes: 65,
    stress: 8,
    workout: true,
    moneyDelta: 0,
  },
  {
    day: 4,
    label: "Day 4",
    sleepHours: 5.4,
    sleepQuality: 3,
    deepWorkMinutes: 210,
    learningMinutes: 70,
    stress: 9,
    workout: true,
    moneyDelta: 0,
  },
  {
    day: 5,
    label: "Day 5",
    sleepHours: 5.2,
    sleepQuality: 3,
    deepWorkMinutes: 220,
    learningMinutes: 80,
    stress: 9,
    workout: true,
    moneyDelta: 0,
  },
  {
    day: 6,
    label: "Day 6",
    sleepHours: 6.8,
    sleepQuality: 6,
    deepWorkMinutes: 120,
    learningMinutes: 45,
    stress: 6,
    workout: false,
    moneyDelta: 0,
  },
  {
    day: 7,
    label: "Day 7",
    sleepHours: 7.1,
    sleepQuality: 7,
    deepWorkMinutes: 95,
    learningMinutes: 35,
    stress: 5,
    workout: false,
    moneyDelta: 0,
  },
  {
    day: 8,
    label: "Day 8",
    sleepHours: 7.4,
    sleepQuality: 7,
    deepWorkMinutes: 85,
    learningMinutes: 30,
    stress: 4,
    workout: false,
    moneyDelta: 0,
  },
  {
    day: 9,
    label: "Day 9",
    sleepHours: 7.8,
    sleepQuality: 8,
    deepWorkMinutes: 80,
    learningMinutes: 25,
    stress: 3,
    workout: false,
    moneyDelta: 0,
  },
  {
    day: 10,
    label: "Day 10",
    sleepHours: 8.0,
    sleepQuality: 8,
    deepWorkMinutes: 75,
    learningMinutes: 20,
    stress: 3,
    workout: false,
    moneyDelta: 0,
  },
];

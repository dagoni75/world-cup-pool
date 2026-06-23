export function predictionPoints(
  predictedA: number,
  predictedB: number,
  actualA: number,
  actualB: number,
) {
  let points = 0;
  const predictedGoalDifference = predictedA - predictedB;
  const actualGoalDifference = actualA - actualB;

  if (Math.sign(predictedGoalDifference) === Math.sign(actualGoalDifference)) {
    points += 3;
  }

  if (predictedA === actualA && predictedB === actualB) {
    points += 2;
  }

  if (predictedGoalDifference === actualGoalDifference) {
    points += 1;
  }

  if (predictedA === actualA) {
    points += 1;
  }

  if (predictedB === actualB) {
    points += 1;
  }

  return points;
}

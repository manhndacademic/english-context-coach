const REVIEW_INTERVALS = [1, 3, 7, 14];

export function nextReviewAfterSuccess(currentIntervalDays: number) {
  const next = REVIEW_INTERVALS.find((interval) => interval > currentIntervalDays);
  return next ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
}

export function nextDueDate(intervalDays: number, from = new Date()) {
  const due = new Date(from);
  due.setDate(due.getDate() + intervalDays);
  return due;
}

export function resetDueAfterFailure(from = new Date()) {
  const due = new Date(from);
  due.setDate(due.getDate() + 1);
  return due;
}

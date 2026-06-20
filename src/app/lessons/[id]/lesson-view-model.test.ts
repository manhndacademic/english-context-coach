import { describe, expect, it } from "vitest";
import {
  groupAttemptsByExercise,
  indexById,
  buildStepperItems,
  indexUserErrorsByAttemptId,
  classifyInputMode,
} from "./lesson-view-model";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttempt(
  exerciseId: string,
  isCorrect: boolean | null,
  id = exerciseId + "-a"
) {
  return { id, exerciseId, isCorrect };
}

function makeExercise(
  id: string,
  keyPhraseId: string | null = null,
  lessonFocusId: string | null = null
) {
  return { id, keyPhraseId, lessonFocusId };
}

// ---------------------------------------------------------------------------
// groupAttemptsByExercise
// ---------------------------------------------------------------------------

describe("groupAttemptsByExercise", () => {
  it("groups multiple attempts for the same exercise", () => {
    const attempts = [
      makeAttempt("ex-1", true, "a1"),
      makeAttempt("ex-1", false, "a2"),
      makeAttempt("ex-2", true, "a3"),
    ];
    const result = groupAttemptsByExercise(attempts);

    expect(result.get("ex-1")).toHaveLength(2);
    expect(result.get("ex-2")).toHaveLength(1);
    expect(result.get("ex-1")![0].id).toBe("a1");
    expect(result.get("ex-1")![1].id).toBe("a2");
  });

  it("handles empty attempts array", () => {
    const result = groupAttemptsByExercise([]);
    expect(result.size).toBe(0);
  });

  it("keeps attempts in insertion order (first attempt first)", () => {
    const attempts = [
      makeAttempt("ex-1", false, "older"),
      makeAttempt("ex-1", true, "newer"),
    ];
    const result = groupAttemptsByExercise(attempts);
    const group = result.get("ex-1")!;
    expect(group[0].id).toBe("older");
    expect(group[1].id).toBe("newer");
  });

  it("creates a separate entry for each distinct exerciseId", () => {
    const attempts = [
      makeAttempt("a", null),
      makeAttempt("b", null),
      makeAttempt("c", null),
    ];
    const result = groupAttemptsByExercise(attempts);
    expect(result.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// indexById
// ---------------------------------------------------------------------------

describe("indexById", () => {
  it("creates a map keyed by id", () => {
    const items = [
      { id: "p1", text: "hello" },
      { id: "p2", text: "world" },
    ];
    const result = indexById(items);
    expect(result.get("p1")).toEqual({ id: "p1", text: "hello" });
    expect(result.get("p2")).toEqual({ id: "p2", text: "world" });
  });

  it("handles empty array", () => {
    const result = indexById([]);
    expect(result.size).toBe(0);
  });

  it("last item wins for duplicate ids", () => {
    const items = [
      { id: "dup", value: "first" },
      { id: "dup", value: "second" },
    ];
    const result = indexById(items);
    expect(result.get("dup")?.value).toBe("second");
    expect(result.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildStepperItems
// ---------------------------------------------------------------------------

describe("buildStepperItems", () => {
  const phrase = { id: "ph-1", text: "break a leg" };
  const focus = { id: "fo-1", title: "Idiom" };

  it("marks exercise as solved when latest attempt is correct", () => {
    const exercise = makeExercise("ex-1");
    const attempt = makeAttempt("ex-1", true);
    const attemptMap = groupAttemptsByExercise([attempt]);

    const [item] = buildStepperItems(
      [exercise],
      attemptMap,
      new Map(),
      new Map()
    );

    expect(item.isSolved).toBe(true);
    expect(item.needsRetry).toBe(false);
  });

  it("marks exercise as needsRetry when latest attempt is incorrect", () => {
    const exercise = makeExercise("ex-1");
    const attempt = makeAttempt("ex-1", false);
    const attemptMap = groupAttemptsByExercise([attempt]);

    const [item] = buildStepperItems(
      [exercise],
      attemptMap,
      new Map(),
      new Map()
    );

    expect(item.isSolved).toBe(false);
    expect(item.needsRetry).toBe(true);
  });

  it("marks exercise as neither solved nor needsRetry when there are no attempts", () => {
    const exercise = makeExercise("ex-1");

    const [item] = buildStepperItems(
      [exercise],
      new Map(),
      new Map(),
      new Map()
    );

    expect(item.isSolved).toBe(false);
    expect(item.needsRetry).toBe(false);
    expect(item.attempts).toHaveLength(0);
  });

  it("resolves keyPhrase and lessonFocus by id", () => {
    const exercise = makeExercise("ex-1", "ph-1", "fo-1");
    const phraseMap = indexById([phrase]);
    const focusMap = indexById([focus]);

    const [item] = buildStepperItems(
      [exercise],
      new Map(),
      phraseMap,
      focusMap
    );

    expect(item.keyPhrase).toEqual(phrase);
    expect(item.lessonFocus).toEqual(focus);
  });

  it("leaves keyPhrase undefined when keyPhraseId is null", () => {
    const exercise = makeExercise("ex-1", null, null);
    const phraseMap = indexById([phrase]);
    const focusMap = indexById([focus]);

    const [item] = buildStepperItems(
      [exercise],
      new Map(),
      phraseMap,
      focusMap
    );

    expect(item.keyPhrase).toBeUndefined();
    expect(item.lessonFocus).toBeUndefined();
  });

  it("uses the first (latest) attempt to determine isSolved and needsRetry", () => {
    // Simulates the page pattern where DB returns most-recent attempt first.
    const exercise = makeExercise("ex-1");
    // First entry = latest attempt (correct); second = earlier wrong attempt
    const attemptMap = new Map([
      [
        "ex-1",
        [
          makeAttempt("ex-1", true, "latest"),
          makeAttempt("ex-1", false, "earlier"),
        ],
      ],
    ]);

    const [item] = buildStepperItems(
      [exercise],
      attemptMap,
      new Map(),
      new Map()
    );

    expect(item.isSolved).toBe(true);
    expect(item.needsRetry).toBe(false);
    expect(item.attempts).toHaveLength(2);
  });

  it("returns an item per exercise preserving order", () => {
    const exercises = [
      makeExercise("e1"),
      makeExercise("e2"),
      makeExercise("e3"),
    ];

    const items = buildStepperItems(exercises, new Map(), new Map(), new Map());

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.exercise.id)).toEqual(["e1", "e2", "e3"]);
  });
});

// ---------------------------------------------------------------------------
// indexUserErrorsByAttemptId
// ---------------------------------------------------------------------------

describe("indexUserErrorsByAttemptId", () => {
  it("indexes errors by attemptId", () => {
    const errors = [
      { attemptId: "att-1", message: "wrong tense" },
      { attemptId: "att-2", message: "missing article" },
    ];
    const result = indexUserErrorsByAttemptId(errors);

    expect(result["att-1"]).toEqual({
      attemptId: "att-1",
      message: "wrong tense",
    });
    expect(result["att-2"]).toEqual({
      attemptId: "att-2",
      message: "missing article",
    });
  });

  it("skips errors without an attemptId (null)", () => {
    const errors = [
      { attemptId: null, message: "orphaned error" },
      { attemptId: "att-1", message: "real error" },
    ];
    const result = indexUserErrorsByAttemptId(errors);

    expect(Object.keys(result)).toHaveLength(1);
    expect(result["att-1"]).toBeDefined();
  });

  it("returns empty object for empty input", () => {
    expect(indexUserErrorsByAttemptId([])).toEqual({});
  });

  it("last error wins when duplicate attemptIds exist", () => {
    const errors = [
      { attemptId: "att-1", message: "first" },
      { attemptId: "att-1", message: "second" },
    ];
    const result = indexUserErrorsByAttemptId(errors);
    expect(result["att-1"].message).toBe("second");
  });
});

// ---------------------------------------------------------------------------
// classifyInputMode
// ---------------------------------------------------------------------------

describe("classifyInputMode", () => {
  it("classifies not_english correctly", () => {
    const flags = classifyInputMode("not_english");
    expect(flags.isNotEnglishOrUnsupported).toBe(true);
  });

  it("classifies unsupported correctly", () => {
    const flags = classifyInputMode("unsupported");
    expect(flags.isNotEnglishOrUnsupported).toBe(true);
  });

  it("classifies standard mode as none of the above", () => {
    const flags = classifyInputMode("standard");
    expect(flags.isNotEnglishOrUnsupported).toBe(false);
  });

  it("returns all false for an empty string", () => {
    const flags = classifyInputMode("");
    expect(flags.isNotEnglishOrUnsupported).toBe(false);
  });
});

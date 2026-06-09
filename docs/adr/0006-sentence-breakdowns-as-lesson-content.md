# Sentence breakdowns as lesson content

Lessons should persist SentenceBreakdown as first-class ordered Lesson content, instead of embedding sentence analysis as JSON on the Lesson row or folding it into KeyPhrases. SentenceBreakdown explains how individual SourceText sentences work, while KeyPhrases remain focused on reusable phrase-level meaning and contextual sense.

This adds a small relational model cost, but keeps sentence-level reading content inspectable, orderable, and available for future links to KeyPhrases or Exercises without overloading the Lesson record.

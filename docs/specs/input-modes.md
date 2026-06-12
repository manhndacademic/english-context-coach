# Input Modes Specification

English Context Coach dynamically classifies and processes text into 7 input modes. The app adapts the backend processing engine, AI schemas, and frontend rendering layout based on the detected or overridden mode.

---

## 1. Input Modes & Descriptions

### A. `understand_and_practice`
*   **Description**: Standard, grammatically correct English text.
*   **Action**: Runs the standard learning flow: explains context, highlights key phrases, and generates practice exercises.

### B. `fix_and_understand`
*   **Description**: Grammatically incorrect English (e.g. Vietlish: *"Yesterday I go to office"*).
*   **Action**: Compares the original text directly with corrected English, highlights grammatical/structural errors, and explains corrections in Vietnamese.

### C. `naturalize_english`
*   **Description**: Grammatically correct but awkward or unnatural English (e.g. *"I very like this"*).
*   **Action**: Suggests more natural phrasing (e.g. *"I really like this"*), highlights style changes, and explains register/tone differences.

### D. `mixed_language_support`
*   **Description**: Mixed English and Vietnamese (e.g. *"Anh check hộ em this ticket"*).
*   **Action**: Extracts the English phrases, translates the mixed context, and isolates the target phrases for learning.

### E. `not_english`
*   **Description**: Primarily non-English text (French, Pure Vietnamese, etc.).
*   **Action**: Shows a friendly warning banner indicating the language is unsupported. Hides vocabulary lists and exercises, and collapses the page to a single-column layout.

### F. `developer_error_explanation`
*   **Description**: Developer error traceback logs (TypeError, SyntaxError, etc.).
*   **Action**: Monospace console terminal view block. Explains the developer error traceback in Vietnamese, listing common causes and resolutions.

### G. `unsupported`
*   **Description**: Gibberish, too short, or meaningless input.
*   **Action**: Shows a warning banner explaining that the text cannot be processed. Hides exercises/key phrases.

---

## 2. Layout Specifications

### A. Grammar & Style Corrections (`fix_and_understand`, `naturalize_english`)
*   **Comparison Panel**: Render a side-by-side comparative panel at the top of the main column:
    *   *Left Box (Original)*: Struck-through red text (`text-decoration: line-through`, reddish background).
    *   *Right Box (Corrected)*: Green checkmark badge, bold green text, representing the natural corrected phrasing.
*   **Breakdown Rows**: Each sentence breakdown compares `sentence` vs `correctedSentenceEn`, with natural meaning and detailed structure explanation notes.

### B. Developer Console Terminal (`developer_error_explanation`)
*   **Stack Trace Box**: Renders the source error text in a dark monospace block styled to resemble a software terminal console.
*   **Resolution Cards**: Displays monospace panels with dedicated title headers:
    *   *Ý nghĩa lỗi (Error Meaning)*: Displays overall error summary.
    *   *Nguyên nhân & Cách sửa (Causes & Resolution)*: Displays context explanation.
    *   *Dịch nghĩa (Translation)*: Conditionally displays literal translation if available.

### C. Warnings Banner (`not_english`, `unsupported`)
*   **Alert Banner**: Renders a warning-colored banner (`--warning` and `--warning-light`) at the top of the page.
*   **Single-Column Layout**: Collapses the layout workspace to a single column (`grid-template-columns: 1fr`) as key phrases and exercises are not rendered.

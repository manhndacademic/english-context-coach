# Manual Test Samples

Use these concrete text samples to check whether the application stays aligned with the product strategy and renders the correct layouts.

---

## 1. Work Message (understand_and_practice)

*   **Pasted Text**:
    ```txt
    Could you take a look when you get a chance?
    ```
*   **Expected Behavior**:
    *   `take a look` = *xem giúp / kiểm tra giúp*
    *   Tone = *polite work request*
    *   Avoid literal translation trap: *"lấy một cái nhìn"*
    *   Standard reading layout is displayed.

---

## 2. Work Scheduling (understand_and_practice)

*   **Pasted Text**:
    ```txt
    We need to push this back until the API contract is finalized.
    ```
*   **Expected Behavior**:
    *   `push this back` = *dời lại / trì hoãn*
    *   `API contract` = *API spec/agreement*, NOT a legal contract.
    *   Standard reading layout is displayed.

---

## 3. Developer Docs (understand_and_practice)

*   **Pasted Text**:
    ```txt
    This endpoint is deprecated and will be removed in a future release.
    ```
*   **Expected Behavior**:
    *   `deprecated` = *không khuyến khích dùng nữa, có thể bị loại bỏ sau này*
    *   Practical meaning = *do not use this endpoint for new code*
    *   Standard reading layout is displayed.

---

## 4. Developer Error (developer_error_explanation)

*   **Pasted Text**:
    ```txt
    TypeError: Cannot read properties of undefined (reading 'map')
    ```
*   **Expected Behavior**:
    *   Explains the developer error traceback in Vietnamese.
    *   Dark monospace terminal console traceback is rendered.
    *   Cards show "Ý nghĩa lỗi", "Nguyên nhân", "Cách sửa".

---

## 5. Vietlish (naturalize_english)

*   **Pasted Text**:
    ```txt
    I very like this solution but it maybe not good for performance.
    ```
*   **Expected Behavior**:
    *   Corrected phrasing: *"I really like this solution, but it may not be good for performance."*
    *   Explains `"very like"` (should be `"really like"`) and `"maybe"` vs `"may be"` issues.
    *   Side-by-side comparative layout is rendered.

---

## 6. Grammar Issue (fix_and_understand)

*   **Pasted Text**:
    ```txt
    Yesterday I go to office and my manager ask me check report.
    ```
*   **Expected Behavior**:
    *   Corrected sentence: *"Yesterday I went to the office and my manager asked me to check the report."*
    *   Explains past tense verbs (`went`, `asked`) and structure `"ask someone to do something"`.
    *   Side-by-side comparative layout is rendered.

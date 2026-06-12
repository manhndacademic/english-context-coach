"use client";

import { useActionState, useState } from "react";
import { SOURCE_TEXT_MAX_LENGTH } from "@/domain/constants";
import { createSourceTextAction, type SourceTextActionState } from "@/app/actions/source-texts";

export function SourceTextForm() {
  const [state, action, pending] = useActionState<SourceTextActionState, FormData>(createSourceTextAction, {});
  const [value, setValue] = useState("");

  return (
    <form action={action} className="stack">
      <label style={{ fontSize: "14px", fontWeight: "600" }}>
        Dán tài liệu tiếng Anh cần phân tích
        <textarea
          name="content"
          value={value}
          maxLength={SOURCE_TEXT_MAX_LENGTH}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Dán tin nhắn Slack, email, GitHub issue, PR comment, tài liệu API hoặc đoạn văn bản tiếng Anh bất kỳ..."
          required
          style={{ marginTop: "4px" }}
        />
      </label>
      <div className="cluster" style={{ justifyContent: "space-between" }}>
        <button className="primary-button" disabled={pending || !value.trim()} type="submit">
          {pending ? "Đang xếp hàng xử lý..." : "Bắt đầu phân tích & tạo bài học"}
        </button>
        <span className="hint" style={{ fontSize: "12px" }}>
          {value.length.toLocaleString()} / {SOURCE_TEXT_MAX_LENGTH.toLocaleString()} ký tự
        </span>
      </div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
    </form>
  );
}

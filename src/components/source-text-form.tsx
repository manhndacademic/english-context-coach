"use client";

import { useActionState, useState } from "react";
import { SOURCE_TEXT_MAX_LENGTH } from "@/domain/constants";
import { createSourceTextAction, type SourceTextActionState } from "@/app/actions/source-texts";

export function SourceTextForm() {
  const [state, action, pending] = useActionState<SourceTextActionState, FormData>(createSourceTextAction, {});
  const [value, setValue] = useState("");

  return (
    <form action={action} className="stack">
      <label>
        Paste English source material
        <textarea
          name="content"
          value={value}
          maxLength={SOURCE_TEXT_MAX_LENGTH}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Paste a Slack message, email, GitHub issue, documentation excerpt, or article section..."
          required
        />
      </label>
      <div className="cluster">
        <button className="primary-button" disabled={pending || !value.trim()} type="submit">
          {pending ? "Queueing..." : "Generate lesson"}
        </button>
        <span className="hint">
          {value.length.toLocaleString()} / {SOURCE_TEXT_MAX_LENGTH.toLocaleString()} characters
        </span>
      </div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
    </form>
  );
}

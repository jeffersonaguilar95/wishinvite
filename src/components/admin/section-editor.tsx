"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { RemoveRowButton } from "./remove-row-button";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import { saveSection } from "@/app/admin/actions";
import { adminMessages } from "@/lib/i18n/admin";

type Values = { name: string; email?: string; description?: string; url?: string };
type Row = { id: string; values: Values; inlineField?: ReactNode; actions?: ReactNode; endAction?: ReactNode };

const input = "mt-1 block w-full rounded border border-slate-400 p-2";
const button = "rounded bg-slate-800 enabled:hover:bg-slate-700 px-4 py-2 text-white disabled:opacity-50";
const outline = "rounded border border-slate-600 px-3 py-2 disabled:opacity-50";

export function SectionEditor({ eventId, section, rows, locale, giftListDescription = "" }: {
  eventId: string;
  section: "guests" | "gifts";
  rows: Row[];
  giftListDescription?: string;
  locale: keyof typeof adminMessages;
}) {
  const t = adminMessages[locale];
  const showToast = useToast();
  const nextRow = useRef(0);
  const [added, setAdded] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Values>>({});
  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof saveSection>> | null>(null);
  const [saving, setSaving] = useState(false);
  const formId = `edit-${section}`;
  const allRows = [...rows, ...added];
  const descriptionChanged = descriptionDraft !== null && descriptionDraft !== giftListDescription;
  const dirty = descriptionChanged || added.length > 0 || rows.some(row => drafts[row.id] !== undefined);
  const fields = section === "guests"
    ? ([["name", t.family, "text", 200], ["email", t.email, "email", 254]] as const)
    : ([["name", t.giftName, "text", 200], ["description", t.description, "text", 2000],
        ["url", t.giftUrl, "url", 2000]] as const);

  function update(row: Row, field: keyof Values, value: string) {
    setDrafts(current => {
      const next = { ...current };
      const values = { ...(current[row.id] ?? row.values), [field]: value };
      if (fields.every(([key]) => (values[key] ?? "") === (row.values[key] ?? ""))) delete next[row.id];
      else next[row.id] = values;
      return next;
    });
    setResult(null);
  }

  function removeDraft(rowId: string) {
    setAdded(current => current.filter(item => item.id !== rowId));
    setDrafts(current => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    setResult(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;

    const data = new FormData();
    if (descriptionChanged) data.set("giftListDescription", descriptionDraft);
    for (const row of allRows) {
      if (!row.id.startsWith("new-") && !drafts[row.id]) continue;
      data.append("rows", row.id);
      const values = drafts[row.id] ?? row.values;
      for (const [key] of fields) data.set(`${row.id}.${key}`, values[key] ?? "");
    }

    setResult(null);
    setSaving(true);
    try {
      const response = await saveSection(eventId, section, data);
      setResult(response);
      if (response.status === "saved") {
        setDrafts({});
        setAdded([]);
        setDescriptionDraft(null);
        showToast({ text: t.saved });
      } else if (response.status === "error") {
        showToast({ text: t.error, error: true });
      }
    } catch {
      showToast({ text: t.error, error: true });
    } finally {
      setSaving(false);
    }
  }

  return <>
    {section === "gifts" && (
      <label className="block">
        {t.giftListDescription}
        <textarea form={formId} className={input} rows={3} maxLength={10000} disabled={saving}
          value={descriptionDraft ?? giftListDescription} onChange={event => {
            setDescriptionDraft(event.target.value);
            setResult(null);
          }} />
      </label>
    )}
    <ul className="space-y-4">
      {allRows.map(row => {
        const values = drafts[row.id] ?? row.values;
        const invalid = result?.status === "invalid" && result.row === row.id;
        const isNew = row.id.startsWith("new-");
        const endAction = isNew
          ? <RemoveRowButton label={section === "gifts" ? t.removeGift : t.removeGuest}
              disabled={saving} onClick={() => removeDraft(row.id)} />
          : row.endAction;
        return <li key={row.id} className="flex items-start gap-3 rounded border p-4">
          <div className="min-w-0 flex-1 space-y-3">
            <fieldset disabled={saving} className="flex min-w-0 flex-wrap items-end gap-3">
              {fields.map(([key, label, type, max]) => (
                <label key={key} className={key === "description" ? "min-w-[min(100%,12rem)] flex-1" : "max-w-full"}>
                  {label}
                  <input form={formId} className={input} type={type} maxLength={max} required={key === "name"}
                    aria-describedby={invalid ? `error-${row.id}` : undefined}
                    value={values[key] ?? ""} onChange={event => update(row, key, event.target.value)} />
                </label>
              ))}
              {row.inlineField}
            </fieldset>
            {invalid && <p id={`error-${row.id}`} role="alert">{t.invalid}</p>}
            {row.actions}
          </div>
          {endAction && <div className="mt-7 shrink-0">{endAction}</div>}
        </li>;
      })}
    </ul>
    <form id={formId} onSubmit={submit} data-section-editor="" data-dirty={dirty} data-saving={saving}
      className="flex flex-wrap items-center gap-3">
      <button type="button" className={outline} disabled={saving} onClick={() => {
        const id = `new-${++nextRow.current}`;
        setAdded(current => [...current, { id, values: { name: "" } }]);
        setResult(null);
      }}>{t.add}</button>
      <SubmitButton className={button} disabled={!dirty} loading={saving}>
        {section === "guests" ? t.saveGuests : t.saveGifts}
      </SubmitButton>
    </form>
  </>;
}

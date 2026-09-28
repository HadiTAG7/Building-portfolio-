"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { currentUserId, deleteFromLibrary, listLibrary, saveToLibrary, type LibraryEntry } from "@/lib/firebase/library";
import { portfolioLabel } from "@/lib/portfolio-label";
import { MAX_PORTFOLIOS, totalWeight, usePortfolioStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import { Button, cx } from "../ui";

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx("max-h-[88vh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-6 shadow-2xl sm:rounded-[28px]", wide ? "sm:max-w-2xl" : "sm:max-w-md")}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[19px] font-extrabold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="close" className="h-9 w-9 rounded-full text-[20px] text-muted hover:bg-sky">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const AUTHOR_KEY = "pb-author";

function SaveDialog({ portfolioId }: { portfolioId: string }) {
  const { t } = useI18n();
  const close = useUiStore((s) => s.closeSave);
  const notify = useUiStore((s) => s.notify);
  const portfolio = usePortfolioStore((s) => s.portfolios.find((p) => p.id === portfolioId));
  const [name, setName] = useState(() => (portfolio ? portfolioLabel(portfolio, t) : ""));
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem(AUTHOR_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!portfolio) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveToLibrary({ name: name || portfolioLabel(portfolio, t), author, note, weights: portfolio.weights });
      try {
        localStorage.setItem(AUTHOR_KEY, author);
      } catch {
        /* storage unavailable */
      }
      notify(t.library.saved);
      close();
    } catch {
      setError(t.library.error);
    } finally {
      setBusy(false);
    }
  };

  const field = "mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-blue";
  return (
    <Modal title={t.library.saveTitle} onClose={close}>
      <div className="space-y-3">
        <label className="block text-[12.5px] font-bold text-muted">
          {t.library.name}
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block text-[12.5px] font-bold text-muted">
          {t.library.author}
          <input value={author} maxLength={40} onChange={(e) => setAuthor(e.target.value)} className={field} />
        </label>
        <label className="block text-[12.5px] font-bold text-muted">
          {t.library.note}
          <textarea value={note} maxLength={280} rows={3} onChange={(e) => setNote(e.target.value)} className={field} />
        </label>
        {error ? <p className="text-[13px] font-bold text-critical">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={close}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || !totalWeight(portfolio)}>
            {t.common.save}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LibraryDialog() {
  const { t, f } = useI18n();
  const close = useUiStore((s) => s.closeLibrary);
  const notify = useUiStore((s) => s.notify);
  const addPortfolio = usePortfolioStore((s) => s.addPortfolio);
  const count = usePortfolioStore((s) => s.portfolios.length);
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, me] = await Promise.all([listLibrary(), currentUserId().catch(() => null)]);
      setEntries(list);
      setUid(me);
    } catch {
      setError(t.library.error);
      setEntries([]);
    }
  }, [t.library.error]);

  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => {
      if (live) void load();
    });
    return () => {
      live = false;
    };
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm(t.library.confirmDelete)) return;
    try {
      await deleteFromLibrary(id);
      setEntries((e) => e?.filter((x) => x.id !== id) ?? null);
    } catch {
      setError(t.library.error);
    }
  };

  return (
    <Modal title={t.library.title} onClose={close} wide>
      <p className="-mt-2 mb-4 text-[13px] text-muted">{t.library.subtitle}</p>
      {error ? <p className="mb-3 text-[13px] font-bold text-critical">{error}</p> : null}
      {entries === null ? (
        <p className="py-8 text-center text-[13px] text-muted">{t.library.loading}</p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted">{t.library.empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {entries.map((e) => {
            const top = Object.entries(e.weights)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([tk, w]) => `${tk} ${f.num(w, w % 1 ? 1 : 0)}%`)
              .join(" · ");
            return (
              <li key={e.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[15px] font-extrabold text-ink">{e.name}</div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      {[e.author ? t.library.by(e.author) : null, e.createdAt ? f.date(new Date(e.createdAt).toISOString().slice(0, 10)) : null, e.ownerUid === uid ? t.library.yours : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="soft"
                      disabled={count >= MAX_PORTFOLIOS}
                      onClick={() => {
                        addPortfolio({ name: e.name, weights: e.weights });
                        notify(e.name);
                        close();
                      }}
                    >
                      {t.library.load}
                    </Button>
                    {e.ownerUid === uid ? (
                      <Button size="sm" variant="danger" onClick={() => remove(e.id)}>
                        {t.common.delete}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="ltr mt-2 text-[12px] text-ink-2">{top}</p>
                {e.note ? <p className="mt-1.5 text-[12.5px] text-muted">{e.note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

export function LibraryLayer() {
  const libraryOpen = useUiStore((s) => s.libraryOpen);
  const saveTargetId = useUiStore((s) => s.saveTargetId);
  return (
    <>
      {libraryOpen ? <LibraryDialog /> : null}
      {saveTargetId ? <SaveDialog key={saveTargetId} portfolioId={saveTargetId} /> : null}
    </>
  );
}

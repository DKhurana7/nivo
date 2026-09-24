import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Page } from '../lib/types';
import { tourSteps, type TourOutcome } from '../lib/walkthrough';

type Box = { x: number; y: number; width: number; height: number };
export function Walkthrough({
  page,
  onNavigate,
  onClose,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  onClose: (outcome: TourOutcome) => void;
}) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const dialog = useRef<HTMLDialogElement>(null),
    card = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const origin = useRef(page),
    callbacks = useRef({ onNavigate, onClose });
  callbacks.current = { onNavigate, onClose };
  const step = tourSteps[index];
  const close = (outcome: TourOutcome) => {
    callbacks.current.onNavigate(origin.current);
    callbacks.current.onClose(outcome);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-tour="help"]')?.focus());
  };
  useEffect(() => {
    const node = dialog.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('tour-active');
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      document.body.classList.remove('tour-active');
    };
  }, []);
  useLayoutEffect(() => {
    callbacks.current.onNavigate(step.page);
    setBox(null);
    let frame = 0,
      settled = false;
    const update = () => {
      const target = [...document.querySelectorAll<HTMLElement>(step.target)].find((n) =>
        n.checkVisibility(),
      );
      const fallback = document.querySelector<HTMLElement>(
        '#main-content .page-heading, #main-content',
      );
      const node = target ?? fallback;
      setMissing(!target);
      if (node && !settled) {
        const rect = node.getBoundingClientRect();
        window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - 24), behavior: 'instant' });
        settled = true;
      }
      const width = innerWidth,
        height = innerHeight;
      const cardHeight = Math.min(card.current?.offsetHeight ?? 360, height - 32);
      const cardWidth = Math.min(440, width - 32);
      const rect = node?.getBoundingClientRect();
      const x = Math.max(8, rect ? rect.left - 5 : 8),
        y = Math.max(8, rect ? rect.top - 5 : 8);
      const phone = width < 760;
      const maxBottom = phone ? height - cardHeight - 24 : height - 8;
      const area = rect
        ? {
            x,
            y,
            width: Math.max(0, Math.min(width - 8, rect.right + 5) - x),
            height: Math.max(0, Math.min(maxBottom, rect.bottom + 5) - y),
          }
        : null;
      setBox(area && area.width > 0 && area.height > 0 ? area : null);
      let left = width - cardWidth - 16,
        top = height - cardHeight - 16;
      if (!phone && area) {
        // Prefer alongside narrow controls; otherwise just below or above the target.
        if (area.x + area.width + 20 + cardWidth <= width) {
          left = area.x + area.width + 20;
          top = area.y;
        } else if (area.x - cardWidth - 20 >= 16) {
          left = area.x - cardWidth - 20;
          top = area.y;
        } else if (area.y + area.height + 16 + cardHeight <= height)
          top = area.y + area.height + 16;
        else if (area.y - cardHeight - 16 >= 16) top = area.y - cardHeight - 16;
      }
      setPosition({
        left: Math.max(16, left),
        top: Math.max(16, Math.min(height - cardHeight - 16, top)),
      });
    };
    // Wait for the new route to render before locating its feature.
    frame = requestAnimationFrame(() => {
      update();
      if (card.current) card.current.scrollTop = 0;
      heading.current?.focus({ preventScroll: true });
    });
    const resize = () => {
      settled = false;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const scroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(scroll);
    if (card.current) observer.observe(card.current);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', scroll, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [step]);
  return (
    <dialog
      ref={dialog}
      data-walkthrough
      className="tour-dialog"
      aria-label="Platform walkthrough"
      aria-describedby="tour-description"
      onCancel={(e) => {
        e.preventDefault();
        close('skipped');
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        const nodes = [
          ...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select'),
        ];
        const first = nodes[0],
          last = nodes.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === heading.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <svg className="tour-shade" aria-hidden="true" width="100%" height="100%">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {box && (
              <rect
                {...{ x: box.x, y: box.y, width: box.width, height: box.height }}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(24,50,71,0.56)" mask="url(#tour-mask)" />
        {box && (
          <rect
            data-tour-spotlight
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            fill="none"
            stroke="#315bdb"
            strokeWidth="2"
          />
        )}
      </svg>
      <section ref={card} className="tour-card" style={position} data-step={step.id}>
        <div className="tour-progress">
          <span>
            {step.chapter} · {index + 1} of {tourSteps.length}
          </span>
          <button className="text-button" onClick={() => close('skipped')}>
            Skip tour
          </button>
        </div>
        <label className="tour-jump">
          Jump to feature
          <select
            aria-label="Jump to tour feature"
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
          >
            {[...new Set(tourSteps.map((s) => s.chapter))].map((chapter) => (
              <optgroup key={chapter} label={chapter}>
                {tourSteps.map((s, i) =>
                  s.chapter === chapter ? (
                    <option key={s.id} value={i}>
                      {i + 1}. {s.title}
                    </option>
                  ) : null,
                )}
              </optgroup>
            ))}
          </select>
        </label>
        <h2 ref={heading} tabIndex={-1}>
          {step.title}
        </h2>
        <p id="tour-description">{step.text}</p>
        {missing && (
          <p className="tour-availability">
            This control appears after the relevant project or records exist. You can still read
            this feature and continue.
          </p>
        )}
        <div className="tour-footer">
          <button
            className="button secondary"
            disabled={!index}
            onClick={() => setIndex((i) => i - 1)}
          >
            Back
          </button>
          <button
            className="button primary"
            onClick={() =>
              index === tourSteps.length - 1 ? close('completed') : setIndex((i) => i + 1)
            }
          >
            {index === tourSteps.length - 1 ? 'Finish tour' : 'Next'}
          </button>
        </div>
        <small>Guided explanation only. No edits, uploads or calls are performed.</small>
      </section>
    </dialog>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';

// Original, compact drafting symbols. No third-party icon pack.
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    overview: (
      <>
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
      </>
    ),
    projects: (
      <>
        <path d="M3 7h7l2-3h9v16H3zM3 10h18" />
      </>
    ),
    boq: (
      <>
        <path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h3M14 16h2" />
      </>
    ),
    rates: (
      <>
        <path d="M3 7h18M3 12h18M3 17h18M8 3v18M16 3v18" />
      </>
    ),
    vendors: (
      <>
        <path d="M3 21V7l9-4 9 4v14M3 21h18M8 21v-6h8v6M8 8v3M16 8v3" />
      </>
    ),
    enquiries: (
      <>
        <path d="M4 4h16v13H9l-5 4zM8 8h8M8 12h5" />
      </>
    ),
    settings: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6" />
      </>
    ),
    plus: <path d="M12 4v16M4 12h16" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    chevron: <path d="m8 5 7 7-7 7" />,
    down: <path d="m5 8 7 7 7-7" />,
    close: <path d="m5 5 14 14M19 5 5 19" />,
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v13m-5-5 5 5 5-5M4 15v6h16v-6" />
      </>
    ),
    edit: (
      <>
        <path d="m4 16 12-12 4 4L8 20H4zM13 7l4 4" />
      </>
    ),
    trash: (
      <>
        <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
      </>
    ),
    phone: <path d="m5 3 4 1 1 5-3 2c2 3 3 4 6 6l2-3 5 1 1 4c-2 5-8 1-12-3S0 5 5 3Z" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v7M12 6v1" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    link: (
      <>
        <path d="m9 15 6-6M9 8l3-3a5 5 0 0 1 7 7l-3 3M15 16l-3 3a5 5 0 0 1-7-7l3-3" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      {paths[name] ?? paths.boq}
    </svg>
  );
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name="projects" size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const returnFocus = useRef(document.activeElement as HTMLElement);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    node
      ?.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=file]), select, textarea')
      ?.focus();
    return () => {
      node?.close();
      queueMicrotask(() => {
        if (!node?.isConnected) returnFocus.current?.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close.current();
      }}
      aria-label={title}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="modal-inner"
      >
        <header className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </motion.div>
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Search({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search">
      <Icon name="search" size={17} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function Skeleton() {
  return (
    <div className="skeleton" role="status" aria-label="Reading workbook">
      <span />
      <span />
      <span />
      <p>Reading your workbook…</p>
    </div>
  );
}
export function PlanDrawing({ variant = 0 }: { variant?: number }) {
  return (
    <svg
      className={`plan-drawing variant-${variant % 3}`}
      viewBox="0 0 420 230"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.5">
        <path d="M45 33h320v165H45z" strokeWidth="3" />
        <path
          d="M45 118h104m38 0h43V33M230 118h135M149 33v51m0 34v80M230 156v42M295 33v85"
          strokeWidth="3"
        />
        <path d="M149 84a34 34 0 0 1 34 34h-34M230 156a38 38 0 0 1 38-38v38" strokeWidth="1" />
        <path d="M63 50h66v50H63zM68 56h24v14H68zM100 56h24v14h-24zM63 76h66M166 45h49v53h-49zM173 51h35v12h-35zM245 45h35v50h-35zM306 44h47v59h-47zM311 50h17v15h-17zM333 50h15v15h-15zM306 72h47" />
        <path d="M64 139h62v39H64zM68 145h54M173 134h35v46h-35zM173 139h-9v11h9m35-11h9v11h-9m-35 13h-9v11h9m35-11h9v11h-9M284 133h61v19h-61zM284 171h61v12h-61zM302 159h27v7h-27z" />
        <path
          d="M45 15h320M45 11v8M365 11v8M27 33v165M23 33h8M23 198h8M45 212h320"
          strokeWidth=".7"
          opacity=".5"
        />
      </g>
      <g fill="currentColor" fontFamily="Manrope Variable, sans-serif" fontSize="7" opacity=".65">
        <text x="188" y="11">
          12 800
        </text>
        <text x="76" y="113">
          BEDROOM
        </text>
        <text x="295" y="193">
          LIVING
        </text>
      </g>
    </svg>
  );
}

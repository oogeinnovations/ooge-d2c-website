// Type-ahead input for the returns form's item name. Suggests the store's
// products (via /api/product-suggest) but still accepts free text, so a
// customer returning something that's no longer listed isn't blocked.
import {useEffect, useId, useRef, useState} from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  label: string;
};

export function ItemPicker({value, onChange, invalid, label}: Props) {
  const listId = useId();
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Only fetch for text the user typed, not after they pick an option —
  // otherwise selecting "Wavepods 1 – Black" would immediately re-search it.
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || value.trim().length < 2) {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    const run = async () => {
      try {
        const res = await fetch(
          `/api/product-suggest?q=${encodeURIComponent(value.trim())}`,
          {signal: controller.signal},
        );
        const body = (await res.json()) as {items?: string[]};
        setOptions(body.items ?? []);
        setActive(-1);
      } catch {
        // Aborted or offline — leave the previous suggestions alone.
      }
    };
    const timer = setTimeout(() => void run(), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const choose = (option: string) => {
    typed.current = false;
    onChange(option);
    setOptions([]);
    setOpen(false);
  };

  const showList = open && options.length > 0;

  return (
    <div className="item-picker">
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Search product…"
        className={invalid ? 'is-invalid' : undefined}
        value={value}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % options.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul className="item-picker__list" role="listbox" id={listId}>
          {options.map((option, i) => (
            <li
              key={option}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : undefined}
              // mousedown, not click: the input's blur would close the list
              // before a click registers.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

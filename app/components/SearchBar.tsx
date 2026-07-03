// Boult-style search pill. Submits to /search?q=… (Hydrogen's search route).
import {useState} from 'react';
import {useNavigate} from 'react-router';

export function SearchBar({onSubmitted}: {onSubmitted?: () => void} = {}) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(
          q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search',
        );
        onSubmitted?.();
      }}
    >
      <svg
        className="search__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        className="search__input"
        type="search"
        placeholder="Search for earbuds, speakers…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search products"
      />
    </form>
  );
}
